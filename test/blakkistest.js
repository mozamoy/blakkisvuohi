/*
    Bläkkisvuohi, a Telegram bot to help track estimated blood alcohol concentration.
    Copyright (C) 2017  Joonas Ulmanen

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/*
    blakkistest.js
    helper functions to ease testing
*/

'use strict';

const utils = require('../app/lib/utils.js');
const users = require('../app/db/users.js');
const groups = require('../app/db/groups.js');
const announcements = require('../app/announcements.js');
const log = require('loglevel');

const pg = require('pg');
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});;

const blakkistest = module.exports = {};

blakkistest.users = [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]; // 10 users
blakkistest.realIds = [];
blakkistest.users = blakkistest.users.map((_, i) => {
    const id = 100 + i;
    const user = new users.User(utils.hashSha256(id), i + '', 80 + i, 'mies', 180 + i, true, announcements.length, Date.now());
    blakkistest.realIds[i] = id;
    return user;
});
const groupId = 1;
const group = new groups.Group(groupId);


log.getLogger('system').setLevel('info');
log.getLogger('db').setLevel('info');
log.getLogger('commands').setLevel('info');


blakkistest.groups = [{
    realId: groupId,
    group: group,
    users: blakkistest.users.map(user => user.userId)
}];

let userInsertValuesStr = blakkistest.users.map(user => {
    return `('${user.userId}', '${utils.encrypt(user.username)}', ${user.weight}, '${user.gender}', ${user.height}, ${user.read_terms}, ${user.read_announcements})`;
});
let userInGroupsValuesStr = blakkistest.groups.map(group => {
    return group.users.map(userId => `('${group.group.groupId}', '${userId}')`).join(', ');
});

blakkistest.mockMsgAndBot = () => {
    let mock = {
        internals: {
            sentChatId: false,
            sentText: false,
            sentOptions: false,
            sentStream: false,
            editText: false,
            editOptions: false
        }
    };
    mock.privateId = 99;
    mock.chatId = 10;
    mock.messageId = 3;
    mock.bot = {
        sendMessage: (chatId, text, options) => {
            mock.internals.sentChatId = chatId;
            mock.internals.sentText = text;
            mock.internals.sentOptions = options;
            return Promise.resolve();
        },
        sendPhoto: (chatId, stream, options) => {
            mock.internals.sentChatId = chatId;
            mock.internals.sentStream = stream;
            mock.internals.sentOptions = options;
            return Promise.resolve();
        },
        editMessageText: (text, options) => {
            mock.internals.editText = text;
            mock.internals.editOptions = options;
            return Promise.resolve();
        }
    };
    mock.msg = {
        chat: {
            id: mock.chatId,
            type: 'private',
            title: 'Chat title'
        },
        from: {
            id: mock.privateId,
            username: 'testuser'
        },
        text: 'mock_text',
        message_id: mock.messageId
    };
    mock.msg.addMessageObj = () => {
        mock.msg.message = {
            message_id: mock.messageId,
            chat: {
                id: mock.chatId
            }
        };
    };
    utils.attachMethods(mock.msg, mock.bot);
    return mock;
};

/*
    for use as a beforeEach function
*/
blakkistest.clearDb = function(done) {
    Promise.all([
        pool.query('delete from users'),
        pool.query('delete from users_drinks'),
        pool.query('delete from users_in_groups')
    ]).then(() => {
        done();
    }).catch((err) => {
        done(new Error(err));
    });
};

blakkistest.resetDbWithTestUsersAndGroups = function(done) {
    Promise.all([
        pool.query('delete from users'),
        pool.query('delete from users_drinks'),
        pool.query('delete from users_in_groups')
    ]).then(() => {
        Promise.all([
                pool.query('insert into users (userid, nick, weight, gender, height, read_terms, read_announcements) values ' + userInsertValuesStr.join(', ')),
                pool.query('insert into users_in_groups (groupid, userid) values ' + userInGroupsValuesStr.join(', '))
            ])
            .then(() => done()).catch((err) => done(new Error(err)));
    }).catch((err) => {
        done(new Error(err));
    });
};

blakkistest.resetDbWithTestUsersAndGroupsAndDrinks = function(done) {
    Promise.all([
        pool.query('delete from users'),
        pool.query('delete from users_drinks'),
        pool.query('delete from users_in_groups')
    ]).then(() => {
        Promise.all([
                pool.query('insert into users (userid, nick, weight, gender, height, read_terms, read_announcements) values ' + userInsertValuesStr.join(', ')),
                pool.query('insert into users_in_groups (groupid, userid) values ' + userInGroupsValuesStr.join(', ')),
                pool.query(`insert into users_drinks (userid, alcohol, description, created) values ('${blakkistest.users[0].userId}', 12347, 'kalja', now()), ('${blakkistest.users[0].userId}', 12347, 'kalja', now() - interval '1 second'), ('${blakkistest.users[1].userId}', 12347, 'kalja', now())`)
            ])
            .then(() => done()).catch((err) => done(new Error(err)));
    }).catch((err) => {
        done(new Error(err));
    });
};