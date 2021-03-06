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
    users.js
    unit tests for users.js functions
*/

/* globals describe, it, beforeEach */

'use strict';

const blakkistest = require('../blakkistest.js');
const assert = require('assert');
const users = require('../../app/db/users.js');
const utils = require('../../app/lib/utils.js');
const announcements = require('../../app/announcements.js');

const pg = require('pg');
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

describe('users.js', function() {
    beforeEach(blakkistest.resetDbWithTestUsersAndGroupsAndDrinks);

    describe('users.User()', function() {
        it('should return a user object with arguments as values', function() {
            const user = new users.User('id', 'nick', 90, 'mies', 190, true, 1, Date.now());
            assert.equal(user.userId, 'id');
            assert.equal(user.username, 'nick');
            assert.equal(user.weight, 90);
            assert.equal(user.gender, 'mies');
            assert.equal(user.height, 190);
            assert.equal(user.read_terms, true);
            assert.equal(user.read_announcements, 1);
            assert(user.created.getTime() <= Date.now());
        });
    });

    describe('users.new()', function() {
        it('should insert a user to database and return a user object', function(done) {
            users.new('1', 'nick', 90, 'mies', 190, true, 1, Date.now())
                .then((user) => {
                    assert.equal(user.username, 'nick');
                    return pool.query('select * from users');
                })
                .then((res) => {
                    assert.notEqual(res.rows.find(x => x.userid === utils.hashSha256('1')), undefined);
                    done();
                })
                .catch((err) => done(err));
        });

        it('should hash user id and encrypt user nick', function(done) {
            users.new('1', 'nick', 90, 'mies', 190, true, 1, Date.now())
                .then((user) => pool.query('select * from users where userid=$1', [user.userId]))
                .then((res) => {
                    const found = res.rows[0];
                    assert.notEqual(found.userid, '1');
                    assert.notEqual(found.nick, 'nick');
                    assert.equal(found.userid, utils.hashSha256('1'));
                    assert.equal(found.nick, utils.encrypt('nick'));
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('users.find()', function() {
        it('should return a correct user', function(done) {
            users.new('1', 'nick', 90, 'mies', 190, true, 1, Date.now())
                .then((user) => {
                    assert.equal(user.username, 'nick');
                    return users.find('1');
                })
                .then((res) => {
                    assert.equal(res.username, 'nick');
                    done();
                })
                .catch((err) => done(err));
        });

        it('should return undefined when not found', function(done) {
            users.new('1', 'nick', 90, 'mies', 190, true, 1, Date.now())
                .then((user) => {
                    assert.equal(user.username, 'nick');
                    return users.find('2');
                })
                .then((res) => {
                    assert.equal(res, undefined);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.drinkBooze()', function() {
        it('should insert a correct amount of drink to db', function(done) {
            const user = blakkistest.users[2];
            pool.query('select * from users_drinks where userid=$1', [user.userId])
                .then((res) => {
                    const rows = res.rows;
                    if (rows.length > 0) {
                        const err = new Error('user doesn\'t have 0 drinks in db');
                        done(err);
                        return Promise.reject(err);
                    }
                    return user.drinkBooze(12347, 'kalja');
                })
                .then(() => pool.query('select * from users_drinks where userId=$1', [user.userId]))
                .then((res) => {
                    const rows = res.rows;
                    if (rows.length !== 1) {
                        const err = new Error('user doesn\'t have 1 drinks in db');
                        done(err);
                        return Promise.reject(err);
                    }
                    if (rows[0].alcohol !== 12347) {
                        const err = new Error('invalid amount of alcohol in db');
                        done(err);
                        return Promise.reject(err);
                    }
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getBooze()', function() {
        it('should return correct amount of booze', function(done) {
            const user = blakkistest.users[0];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    assert.equal(rows[0].alcohol, 12347);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getBooze()', function() {
        it('should return correct amount of booze', function(done) {
            const user = blakkistest.users[0];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    assert.equal(rows[0].alcohol, 12347);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getDrinkSumForXHours()', function() {
        it('should return correct sum of booze', function(done) {
            const user = blakkistest.users[0];
            user.getDrinkSumForXHours(24)
                .then((res) => {
                    assert.equal(res.sum, 12347 * 2);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.undoDrink()', function() {
        it('should remove last drink from db', function(done) {
            const user = blakkistest.users[0];
            user.drinkBooze(12347, 'testUndo')
                .then(() => user.getBooze())
                .then((rows) => {
                    assert.equal(rows.length, 3);
                    assert(rows.find(x => x.description === 'testUndo'));
                    return user.undoDrink();
                })
                .then(() => user.getBooze())
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    assert(!rows.find(x => x.description === 'testUndo'));
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.joinGroup()', function() {
        it('should insert user to a group in db as a hash of the groupid', function(done) {
            const user = blakkistest.users[0];
            user.joinGroup(12347)
                .then(() => pool.query('select * from users_in_groups where userid=$1', [user.userId]))
                .then((res) => {
                    let rows = res.rows;
                    assert(rows.find(x => x.userid === user.userId && x.groupid === utils.hashSha256(12347)));
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.leaveGroup()', function() {
        it('should delete user from a group in db', function(done) {
            const user = blakkistest.users[0];
            user.joinGroup(12347)
                .then(() => pool.query('select * from users_in_groups where userid=$1', [user.userId]))
                .then((res) => {
                    let rows = res.rows;
                    assert.equal(rows.length, 2);
                    assert(rows.find(x => x.userid === user.userId && x.groupid === utils.hashSha256(12347)));
                    return user.leaveGroup(12347);
                })
                .then(() => pool.query('select * from users_in_groups where userid=$1', [user.userId]))
                .then((res) => {
                    let rows = res.rows;
                    assert.equal(rows.length, 1);
                    assert(!rows.find(x => x.groupid === utils.hashSha256(12347)));
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.drinkBoozeReturnEBAC()', function() {
        it('should insert drink to the db and return ebac after that', function(done) {
            const user = blakkistest.users[3];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 0);
                    return user.drinkBoozeReturnEBAC(12347, 'kalja');
                })
                .then((ebac) => {
                    assert(ebac.permilles > 0);
                    assert(ebac.permilles30Min > 0);
                    assert(ebac.grams > 0);
                    return user.getBooze();
                })
                .then((rows) => {
                    assert.equal(rows.length, 1);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.updateInfo', function() {
        it('should update user info in db', function(done) {
            const user = blakkistest.users[0];
            pool.query('select * from users where userId=$1', [user.userId])
                .then((res) => {
                    const found = res.rows[0];
                    assert.equal(utils.decrypt(found.nick), '0');
                    assert.equal(found.weight, 80);
                    assert.equal(found.gender, 'mies');
                    assert.equal(found.height, 180);
                    assert.equal(found.read_terms, true);
                    return user.updateInfo('nick', 90, 'nainen', 200, false);
                })
                .then(() => pool.query('select * from users where userId=$1', [user.userId]))
                .then((res) => {
                    const found = res.rows[0];
                    assert.equal(utils.decrypt(found.nick), 'nick');
                    assert.equal(found.weight, 90);
                    assert.equal(found.gender, 'nainen');
                    assert.equal(found.height, 200);
                    assert.equal(found.read_terms, false);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.updateReadAnnouncements', function() {
        it('should update user read announcements value in db', function(done) {
            const user = blakkistest.users[0];
            pool.query('select * from users where userId=$1', [user.userId])
                .then((res) => {
                    const found = res.rows[0];
                    assert.equal(found.read_announcements, announcements.length);
                    return user.updateReadAnnouncements(announcements.length + 1);
                })
                .then(() => pool.query('select * from users where userId=$1', [user.userId]))
                .then((res) => {
                    const found = res.rows[0];
                    assert.equal(found.read_announcements, announcements.length + 1);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.drinkBoozeLate', function() {
        it('should insert 2 drinks with different timestamps to db and return EBAC', function(done) {
            const user = blakkistest.users[3];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 0);
                    return user.drinkBoozeLate([{
                        mg: 12347,
                        text: 'kalja'
                    }, {
                        mg: 12347,
                        text: 'kalja2'
                    }], 2);
                })
                .then((ebac) => {
                    assert(ebac.permilles > 0);
                    assert(ebac.permilles30Min > 0);
                    assert(ebac.grams > 0);
                    return user.getBooze();
                })
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    assert.notEqual(rows[0].created, rows[1].created);
                    assert.equal(rows[0].alcohol, 12347);
                    assert.equal(rows[1].alcohol, 12347);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getBoozeForLastHours', function() {
        it('should return drinks only for last N hours', function(done) {
            const user = blakkistest.users[0];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    // drinkBoozeLate to insert a drink 3 hours into the past
                    return user.drinkBoozeLate([{
                        mg: 12347,
                        text: 'kalja'
                    }], 3);
                })
                .then(() => user.getBooze())
                .then((rows) => {
                    assert.equal(rows.length, 3);
                    return user.getBoozeForLastHours(2);
                })
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    return user.getBoozeForLastHours(4);
                })
                .then((rows) => {
                    assert.equal(rows.length, 3);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getDrinkSumForXHours', function() {
        it('should return drink sum only for last N hours', function(done) {
            const user = blakkistest.users[0];
            user.getBooze()
                .then((rows) => {
                    assert.equal(rows.length, 2);
                    // drinkBoozeLate to insert a drink 3 hours into the past
                    return user.drinkBoozeLate([{
                        mg: 12347,
                        text: 'kalja'
                    }], 3);
                })
                .then(() => user.getBooze())
                .then((rows) => {
                    assert.equal(rows.length, 3);
                    return user.getDrinkSumForXHours(2);
                })
                .then((res) => {
                    assert.equal(res.sum, 12347 * 2);
                    return user.getDrinkSumForXHours(4);
                })
                .then((res) => {
                    assert.equal(res.sum, 12347 * 3);
                    done();
                })
                .catch((err) => done(err));
        });
    });

    describe('User.getLastNUniqueDrinks', function() {
        it('should return 2 unique drinks', function(done) {
            const user = blakkistest.users[0];
            user.getLastNUniqueDrinks()
                .then((rows) => {
                    assert.notEqual(rows.length, 0);
                    done();
                })
                .catch((err) => done(err));
        });

        it('should return no drinks with exclude kalja', function(done) {
            const user = blakkistest.users[0];
            user.getLastNUniqueDrinks(2, 'kalja')
                .then((rows) => {
                    assert.equal(rows.length, 0);
                    done();
                })
                .catch((err) => done(err));
        });
    });
});