"use strict";
var chai = require('chai');
var expect = chai.expect;
// defaults to test, but selects skip if:
// @param conditions.requires must all be true when cast to boolearn
// @param conditions.requires must all be false when cast to boolearn
function testOrSkip(conditions) {
    var skip = false;
    if (conditions.requires) {
        skip = !conditions.requires.every(function (condition) { return condition; });
    }
    if (!skip && conditions.skip_if) {
        skip = conditions.skip_if.some(function (condition) { return condition; });
    }
    return skip ? it.skip : it;
}
// @return the element at given field path, e.g. "hat.size""
function getValue(obj, fieldpath) {
    var name_components = fieldpath.split('.');
    for (var i in name_components) {
        var name_component = name_components[i];
        obj = obj[name_component];
        if (obj == null)
            return null;
    }
    return obj;
}
function getRandomValue(type) {
    var value = Math.random();
    if (type === 'string') {
        value = value.toString();
    }
    return value;
}
function expectDBOjectToContainAllObjectFields(db_obj, obj) {
    for (var key in obj) {
        expect(obj[key]).to.deep.equal(db_obj[key]);
    }
}
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_create(getDB, createNewObject, config) {
    it('+ should create a new object', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            expect(created_obj).to.not.be.eql(obj);
            expect(created_obj._id).to.exist;
            config.forEach(function (fieldname) {
                expect(created_obj[fieldname]).to.equal(obj[fieldname]);
            });
        });
    });
    it('+ should not modify the original object', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            expect(obj).to.not.have.property('_id');
        });
    });
    it('+ should return an error if the object to be created contains an _id', function () {
        var db = getDB();
        var obj = createNewObject();
        obj['_id'] = '123456789012345678901234';
        return db.create(obj).then(function (created_obj) {
            throw new Error('_id not allowed in object to be created');
        }, function (error) {
            expect(error.message).to.equal('_id isnt allowed for create');
            return 'ok';
        });
    });
}
exports.test_create = test_create;
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_read(getDB, createNewObject, config) {
    it('+ should read a previously created object', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            return db.read(created_obj._id).then(function (read_obj) {
                expect(read_obj).to.not.be.eql(obj);
                config.forEach(function (fieldname) {
                    expect(created_obj[fieldname]).to.equal(obj[fieldname]);
                });
            });
        });
    });
    it('+ should return no result for a non-existant object', function () {
        var db = getDB();
        return db.read('ffffffffffffffffffffffff').then(function (result) {
            expect(result).to.not.exist;
        }, function (error) {
            console.log('ERROR: read of valid format _id, but not referenceing an object should not return error');
            throw error;
        });
    });
    it('should return an error when the request is missing the _id', function () {
        var db = getDB();
        return db.read(undefined).then(function (result) {
            throw new Error('read of invalid _id should return error');
        }, function (error) {
            expect(error.message).to.equal('_id is invalid');
            return 'ok';
        });
    });
}
exports.test_read = test_read;
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_replace(getDB, createNewObject, config) {
    //      AssertionError: expected { Object (_id, account_email, ...) } to not deeply equal { Object (__v, account_email, ...) }
    it('+ should replace an existing object', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            expect(config.length).to.be.at.least(1);
            config.forEach(function (fieldname) {
                created_obj[fieldname] = created_obj[fieldname] + 1;
            });
            return db.replace(created_obj).then(function (replaced_obj) {
                expect(replaced_obj).to.not.equal(created_obj);
                config.forEach(function (fieldname) {
                    expect(replaced_obj[fieldname]).to.equal(created_obj[fieldname]);
                    expect(replaced_obj[fieldname]).to.not.equal(obj[fieldname]);
                });
            });
        });
    });
}
exports.test_replace = test_replace;
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_update(getDB, createNewObject, config) {
    var unsupported_array = (config.unsupported && config.unsupported.array) || { set: false, unset: false, insert: false, remove: false };
    var unsupported_object = (config.unsupported && config.unsupported.object) || { set: false, unset: false };
    function test_update(obj, conditions, update_cmd) {
        var db = getDB();
        if (conditions == null)
            conditions = {};
        var _id;
        return db.create(obj).then(function (result) {
            _id = result._id;
            conditions['_id'] = _id;
            return db.update(conditions, [update_cmd]).then(function (updated_obj) {
                expect(updated_obj._id).to.equal(_id);
                return updated_obj;
            });
        });
    }
    describe('if selected item has a path without an array:', function () {
        describe('cmd=set:', function () {
            var cmd = 'set';
            var _it = testOrSkip({ requires: [!!config.test.populated_string], skip_if: [unsupported_object[cmd]] });
            _it('+ should replace an existing field in an object', function () {
                var obj = createNewObject();
                var populated_string = config.test.populated_string;
                expect(obj[populated_string]).to.exist;
                var replacement_value = obj[populated_string] + 1;
                var UPDATE_CMD = { cmd: cmd, field: populated_string, value: replacement_value };
                return test_update(obj, null, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[populated_string]).to.equal(replacement_value);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.unpopulated_string], skip_if: [unsupported_object[cmd]] });
            _it('+ should create a non-existant field in an object', function () {
                var obj = createNewObject();
                var unpopulated_string = config.test.unpopulated_string;
                expect(obj[unpopulated_string]).to.not.exist;
                var value = 'abc';
                var UPDATE_CMD = { cmd: cmd, field: unpopulated_string, value: value };
                return test_update(obj, null, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[unpopulated_string]).to.equal(value);
                });
            });
        });
        describe('cmd=unset', function () {
            var cmd = 'unset';
            var _it = testOrSkip({ requires: [!!config.test.populated_string], skip_if: [unsupported_object[cmd]] });
            _it('+ should remove an existing field in an object', function () {
                var obj = createNewObject();
                var populated_string = config.test.populated_string;
                var UPDATE_CMD = { cmd: cmd, field: populated_string };
                return test_update(obj, null, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[populated_string]).to.be.undefined;
                });
            });
        });
    });
    describe('if selected item has a path with an array', function () {
        describe('cmd=set', function () {
            var cmd = 'set';
            var _it = testOrSkip({ requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]] });
            _it('+ should replace an existing element in an array of simple types', function () {
                var string_array = config.test.string_array;
                var obj = createNewObject();
                var original_value = obj[string_array.name][0];
                var updated_value = original_value + 1;
                var conditions = { _id: obj._id };
                conditions[string_array.name] = original_value;
                var UPDATE_CMD = { cmd: cmd, field: string_array.name, element_id: original_value, value: updated_value };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[string_array.name].length).to.equal(1);
                    expect(updated_obj[string_array.name][0]).to.equal(updated_value);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('+ should replace an existing element in an array of objects', function () {
                var obj_array = config.test.obj_array;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var REPLACED_ELEMENT = obj_array.createElement();
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, value: REPLACED_ELEMENT };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[obj_array.name].length).to.equal(1);
                    var updated_first_element = updated_obj[obj_array.name][0];
                    expect(updated_first_element).to.deep.equal(REPLACED_ELEMENT);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.unpopulated_field], skip_if: [unsupported_array.set] });
            _it('+ should create a new field in an existing element in an array of objects', function () {
                var obj_array = config.test.obj_array;
                var unpopulated_field = obj_array.unpopulated_field;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var value = getRandomValue(unpopulated_field.type);
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: unpopulated_field.name, value: value };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    var updated_first_element = updated_obj[obj_array.name][0];
                    var updated_value = getValue(updated_first_element, unpopulated_field.name);
                    expect(updated_value).to.equal(value);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('+ should replace an existing field in an existing element in an array of objects', function () {
                var obj_array = config.test.obj_array;
                var populated_field = config.test.obj_array.populated_field;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var replacement_obj = createNewObject();
                var value = getValue(replacement_obj[obj_array.name][0], populated_field.name);
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: populated_field.name, value: value };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    var updated_first_element = updated_obj[obj_array.name][0];
                    var updated_value = getValue(updated_first_element, populated_field.name);
                    expect(updated_value).to.equal(value);
                });
            });
        });
        describe('cmd=unset ', function () {
            var cmd = 'unset';
            var _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('+ should remove an existing field from an existing element in the array', function () {
                var obj_array = config.test.obj_array;
                var populated_field = config.test.obj_array.populated_field;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var replacement_obj = createNewObject();
                var value = getValue(replacement_obj[obj_array.name][0], populated_field.name);
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: populated_field.name };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    var updated_first_element = updated_obj[obj_array.name][0];
                    expect(updated_first_element).to.exist;
                    var updated_value = getValue(updated_first_element, populated_field.name);
                    expect(updated_value).to.not.exist;
                });
            });
            _it = testOrSkip({ requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]] });
            _it('- should not remove or delete an existing element of an array of simple types', function () {
                var string_array = config.test.string_array;
                var obj = createNewObject();
                var original_value = obj[string_array.name][0];
                var conditions = {};
                conditions[string_array.name] = original_value;
                var UPDATE_CMD = { cmd: cmd, field: string_array.name, element_id: original_value };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    throw new Error('unset unexpectedly succeeded');
                }, function (error) {
                    if (error != null) {
                        expect(error.message).to.equal('cmd=unset not allowed on array without a subfield, use cmd=remove');
                        return 'ok';
                    }
                    else {
                        throw new Error('unset unexpectedly succeeded');
                    }
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('- should not remove or delete an existing element of an array of objects', function () {
                var obj_array = config.test.obj_array;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    throw new Error('unset unexpectedly succeeded');
                }, function (error) {
                    if (error != null) {
                        expect(error.message).to.equal('cmd=unset not allowed on array without a subfield, use cmd=remove');
                        return 'ok';
                    }
                    else {
                        throw new Error('unset unexpectedly succeeded');
                    }
                });
            });
        });
        describe('cmd=insert', function () {
            var cmd = 'insert';
            var _it = testOrSkip({ requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]] });
            _it('+ should create a new element in an array of simple types', function () {
                var string_array = config.test.string_array;
                var obj = createNewObject();
                var original_value = getRandomValue('string');
                obj[string_array.name] = [original_value];
                var conditions = {};
                conditions[string_array.name] = original_value;
                var additional_value = getRandomValue('string');
                var UPDATE_CMD = { cmd: cmd, field: string_array.name, value: additional_value };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    var array = updated_obj[string_array.name];
                    expect(array.length).to.equal(2);
                    expect(array[0]).to.equal(original_value);
                    expect(array[1]).to.equal(additional_value);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('+ should create a new element in an array of objects', function () {
                var obj_array = config.test.obj_array;
                var obj = createNewObject();
                var original_first_element = obj[obj_array.name][0];
                var original_element_id = original_first_element[obj_array.key_field];
                var path = obj_array.name + "." + obj_array.key_field;
                var conditions = {};
                conditions[path] = original_element_id;
                var added_element = obj_array.createElement();
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, value: added_element };
                return test_update(obj, conditions, UPDATE_CMD).then(function (updated_obj) {
                    var array = updated_obj[obj_array.name];
                    expect(array).to.have.lengthOf(2);
                    // didn't compare entire component via deep.equal because of _id
                    expectDBOjectToContainAllObjectFields(array[0], original_first_element);
                    expectDBOjectToContainAllObjectFields(array[1], added_element);
                });
            });
        });
        describe('cmd=remove', function () {
            var cmd = 'remove';
            var _it = testOrSkip({ requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]] });
            _it('+ should remove an existing element from an array of simple types', function () {
                var string_array = config.test.string_array;
                var obj = createNewObject();
                expect(obj[string_array.name]).to.have.lengthOf(1);
                var original_value = obj[string_array.name][0];
                var UPDATE_CMD = { cmd: cmd, field: string_array.name, element_id: original_value };
                return test_update(obj, undefined, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[string_array.name]).to.have.lengthOf(0);
                });
            });
            _it = testOrSkip({ requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]] });
            _it('+ should remove an existing element from an array of objects', function () {
                var obj_array = config.test.obj_array;
                var obj = createNewObject();
                expect(obj[obj_array.name]).to.have.lengthOf(1);
                var first_element = obj[obj_array.name][0];
                var element_id = first_element[obj_array.key_field];
                var UPDATE_CMD = { cmd: cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: element_id };
                return test_update(obj, undefined, UPDATE_CMD).then(function (updated_obj) {
                    expect(updated_obj[obj_array.name]).to.have.lengthOf(0);
                });
            });
        });
    });
}
exports.test_update = test_update;
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_del(getDB, createNewObject, config) {
    it('+ should not be able to read after delete', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            return db.del(created_obj._id).then(function (result) {
                return db.read(created_obj._id).then(function (read_obj) {
                    expect(read_obj).to.not.exist;
                });
            });
        });
    });
    it('- should return an error when the request is missing the _id', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.del(undefined).then(function (result) {
            throw new Error('expected del to return error');
        }, function (error) {
            expect(error.message).to.equal('_id is invalid');
            return 'ok';
        });
    });
    it('- should not return an error when the _id doesnt reference an object', function () {
        var query_id = '123456789012345678901234';
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            return db.del(query_id).then(function (result) {
                expect(result).to.not.exist;
            });
        });
    });
}
exports.test_del = test_del;
// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
function test_find(getDB, createNewObject, unique_key_fieldname) {
    it('+ should find an object with a matching name', function () {
        var db = getDB();
        var obj = createNewObject();
        return db.create(obj).then(function (created_obj) {
            var conditions = {};
            conditions[unique_key_fieldname] = obj[unique_key_fieldname];
            return db.find(conditions).then(function (found_objs) {
                expect(found_objs).to.be.instanceof(Array);
                expect(found_objs).to.have.lengthOf(1);
                var found_obj = found_objs[0];
                expect(found_obj[unique_key_fieldname]).to.equal(obj[unique_key_fieldname]);
            });
        });
    });
    describe('cursor', function () {
        // add 20 elements to the database
        before(function () {
            var db = getDB();
            var promises = [];
            for (var i = 0; i < 20; ++i) {
                var obj = createNewObject();
                promises.push(db.create(obj));
            }
            return Promise.all(promises);
        });
        it('should return the first item when start_offset = 0', function () {
            var db = getDB();
            var find_promise = db.find(undefined, undefined, undefined, { start_offset: 0 });
            find_promise.then(function (found_objs) {
                // cannot know which database item will be first
                expect(found_objs[0]).to.exist;
            });
        });
        it('should default start_offset to 0', function () {
            var db = getDB();
            // get the first element
            return db.find(undefined, undefined, undefined, { start_offset: 0 }).then(function (found_objs) {
                expect(found_objs[0]).to.exist;
                // save the first element
                var first_element = found_objs[0];
                return db.find(undefined, undefined, undefined, undefined).then(function (found_objs) {
                    // confirm the default returns the first element
                    expect(found_objs[0]).to.eql(first_element);
                });
            });
        });
        it('should return the tenth item when start_offset = 9', function () {
            var db = getDB();
            return db.find(undefined, undefined, undefined, { start_offset: 0, count: 10 }).then(function (found_objs) {
                expect(found_objs[9]).to.exist;
                var saved = found_objs;
                return db.find(undefined, undefined, undefined, { start_offset: 9 }).then(function (found_objs) {
                    // confirm the default returns the first element
                    expect(found_objs[0]).to.eql(saved[9]);
                });
            });
        });
        it('should return one item if count = 1', function () {
            var db = getDB();
            return db.find(undefined, undefined, undefined, { count: 1 }).then(function (found_objs) {
                expect(found_objs).to.have.lengthOf(1);
            });
        });
        it('should default count to 10', function () {
            var db = getDB();
            return db.find(undefined, undefined, undefined, undefined).then(function (found_objs) {
                expect(found_objs).to.have.lengthOf(10);
            });
        });
        it('should return 11 items if count = 11', function () {
            var db = getDB();
            return db.find(undefined, undefined, undefined, { count: 11 }).then(function (found_objs) {
                expect(found_objs).to.have.lengthOf(11);
            });
        });
    });
}
exports.test_find = test_find;
