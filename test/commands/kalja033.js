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
    kalja033.js
    unit tests for kalja033.js functions
*/

/* globals describe, it, beforeEach */

'use strict';
require('../../app/commands/kalja033.js');

const assert = require('assert');
const blakkistest = require('../blakkistest.js');
const Commands = require('../../app/lib/commands.js');

describe('kalja033.js', function() {
    beforeEach(blakkistest.resetDbWithTestUsersAndGroupsAndDrinks);
    it('Calling /kalja033 should add a drink to db for the user and return ebac', function(done) {
        const mocked = blakkistest.mockMsgAndBot();
        const user = blakkistest.users[0];
        mocked.msg.from.id = blakkistest.realIds[0];

        user.getBooze()
            .then((rows) => {
                try {
                    assert.equal(rows.length, 2);
                    assert(!rows.find(x => x.description === '/kalja033'));
                } catch (err) {
                    return Promise.reject(err);
                }
                Commands.call('/kalja033', mocked.msg, ['/kalja033']);
                let p = new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(user.getBooze());
                    }, 50);
                });
                return p;
            })
            .then((rows) => {
                try {
                    assert.equal(rows.length, 3);
                    assert(rows.find(x => x.description === '/kalja033'));
                    assert.notEqual(mocked.internals.sentText.match('‰'), null);
                } catch (err) {
                    return Promise.reject(err);
                }
                done();
            })
            .catch((err) => done(err));
    });
});