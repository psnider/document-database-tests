import chai                             = require('chai')
var expect                              = chai.expect

import {DocumentDatabase, UpdateFieldCommand, Cursor} from 'document-database-if'
import {UnsupportedUpdateArrayCmds, UnsupportedUpdateObjectCmds,UpdateConfiguration} from './document-database-tests.d.ts'


// defaults to test, but selects skip if:
// @param conditions.requires must all be true when cast to boolearn
// @param conditions.requires must all be false when cast to boolearn
function testOrSkip(conditions: {requires?: boolean[], skip_if?: boolean[]}): Mocha.ITestDefinition {
    let skip = false
    if (conditions.requires) {
        skip = !conditions.requires.every((condition) => {return condition}) 
    }
    if (!skip && conditions.skip_if) {
        skip = conditions.skip_if.some((condition) => {return condition}) 
    }
    return skip ? <Mocha.ITestDefinition>it.skip : it
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



function getRandomValue(type: string): number | string {
    var value: number | string = Math.random()
    if (type === 'string') {
        value = value.toString()
    }
    return value
}



function expectDBOjectToContainAllObjectFields(db_obj, obj) {
    for (var key in obj) {
        expect(obj[key]).to.deep.equal(db_obj[key])
    }
}

// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_create<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, config: string[]): void {

    it('+ should create a new object', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        db.create(obj).then(
            (created_obj) => {
                expect(created_obj).to.not.be.eql(obj)
                expect(created_obj._id).to.exist
                config.forEach((fieldname) => {
                    expect(created_obj[fieldname]).to.equal(obj[fieldname])
                })
                done()
            },
            (error) => {
                done(error)
            }
        )
    })


    it('+ should not modify the original object', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        db.create(obj).then(
            (created_obj) => {
                expect(obj).to.not.have.property('_id')
                done()
            },
            (error) => {
                done(error)
            }
        )
    })


    it('+ should return an error if the object to be created contains an _id', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        obj['_id'] = '123456789012345678901234'
        db.create(obj).then(
            (created_obj) => {
                done(new Error('_id not allowed in object to be created'))
            },
            (error) => {
                expect(error.message).to.equal('_id isnt allowed for create')
                done()
            }
        )
    })

}


// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_read<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, config: string[]): void {

    it('+ should read a previously created object', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                var read_promise = db.read(created_obj._id)
                read_promise.then(
                    (read_obj: T) => {
                        expect(read_obj).to.not.be.eql(obj)
                        config.forEach((fieldname) => {
                            expect(created_obj[fieldname]).to.equal(obj[fieldname])
                        })
                        done()
                    }
                )
            },
            (error) => {
                done(error)
            }
        )
    })


    it('+ should return no result for a non-existant object', function(done) {
        var db = getDB()
        var read_promise = db.read('ffffffffffffffffffffffff')
        read_promise.then(
            (result) => {
                expect(result).to.not.exist
                done()
            },
            (error) => {
                done(new Error('read of valid format _id, but not referenceing an object should not return error'))
            }
        )
    })


    it('should return an error when the request is missing the _id', function(done) {
        var db = getDB()
        var read_promise = db.read(undefined)
        read_promise.then(
            (result) => {
                done(new Error('read of invalid _id should return error'))
            },
            (error) => {
                expect(error.message).to.equal('_id is invalid')
                done()
            }
        )
    })

}



// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_replace<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, config: string[]): void {

    it('+ should replace an existing object', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                created_obj.name = 'widget-replaced'
                created_obj.catalog_number = 'W-123-replaced'
                var replace_promise = db.replace(created_obj)
                replace_promise.then(
                    (replaced_obj) => {
                        expect(replaced_obj).to.not.eql(created_obj)
                        config.forEach((fieldname) => {
                            expect(created_obj[fieldname]).to.equal(obj[fieldname])
                        })
                        done()
                    },
                    (error) => {
                        done(error)
                    }
                )
                done()
            },
            (error) => {
                done(error)
            }
        )
    })

}

// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_update<T extends {_id?: string}>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, config: UpdateConfiguration): void {

    let unsupported_array:  UnsupportedUpdateArrayCmds  = (config.unsupported && config.unsupported.array) || {set: false, unset: false, insert: false, remove: false}
    let unsupported_object: UnsupportedUpdateObjectCmds = (config.unsupported && config.unsupported.object) || {set: false, unset: false}


    function test_update(obj, conditions, update_cmd: UpdateFieldCommand, done, tests) {
        var db = getDB()
        if (conditions == null)  conditions = {}
        var _id
        function update(result: T) {
            _id = result._id
            conditions['_id'] = _id
            return db.update(conditions, [update_cmd])
        }
        var create_promise = db.create(obj)
        var update_promise = create_promise.then(update)
        update_promise.then(
            (updated_obj) => {
                expect(updated_obj._id).to.equal(_id)
                tests(updated_obj)
                done()
            },
            (error) => {
                done(error)
            }
        )
    }


    describe('if selected item has a path without an array:', function() {

        describe('cmd=set:', function() {

            let cmd = 'set'

            let _it = testOrSkip({requires: [!!config.test.populated_string], skip_if: [unsupported_array[cmd]]})
            _it('+ should replace an existing field in an object', function(done) {
                var obj: T = createNewObject()
                var populated_string = config.test.populated_string 
                expect(obj[populated_string]).to.exist
                var replacement_value = obj[populated_string] + 1
                var UPDATE_CMD: UpdateFieldCommand = {cmd, field: populated_string, value: replacement_value}
                test_update(obj, null, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj[populated_string]).to.equal(replacement_value)
                })
            })


            _it = testOrSkip({requires: [!!config.test.unpopulated_string], skip_if: [unsupported_array[cmd]]})
            _it('+ should create a non-existant field in an object', function(done) {
                var obj: T = createNewObject()
                var unpopulated_string = config.test.unpopulated_string 
                expect(obj[unpopulated_string]).to.not.exist
                var value = 'abc'
                var UPDATE_CMD: UpdateFieldCommand = {cmd, field: unpopulated_string, value}
                test_update(obj, null, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj[unpopulated_string]).to.equal(value)
                })
            })


        })


        describe('cmd=unset', function() {

            let cmd = 'unset'


            let _it = testOrSkip({requires: [!!config.test.populated_string], skip_if: [unsupported_array[cmd]]})
            _it('+ should remove an existing field in an object', function(done) {
                var obj: T = createNewObject()
                var populated_string = config.test.populated_string 
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: populated_string}
                test_update(obj, null, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj[populated_string]).to.be.undefined
                })
            })


        })

    })


    describe('if selected item has a path with an array', function() {

        describe('cmd=set', function() {

            let cmd = 'set'


            let _it = testOrSkip({requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]]})
            _it('+ should replace an existing element in an array of simple types', function(done) {
                var string_array = config.test.string_array
                var obj: T = createNewObject()
                const original_value = 'for all uses'
                const updated_value = 'dont use with anti-widgets!'
                obj[string_array.name] = [original_value]
                var conditions = {}
                conditions[string_array.name] = original_value
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: string_array.name, element_id: original_value, value: updated_value}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj[string_array.name].length).to.equal(1)
                    expect(updated_obj[string_array.name][0]).to.equal(updated_value)
                })
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('+ should replace an existing element in an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var obj: T = createNewObject()
                var original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var REPLACED_COMPONENT = obj_array.createElement()
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, value: REPLACED_COMPONENT}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj.components.length).to.equal(1)
                    var component = updated_obj.components[0]
                    expect(component).to.deep.equal(REPLACED_COMPONENT)
                })
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.unpopulated_field], skip_if: [unsupported_array.set]})
            _it('+ should create a new field in an existing element in an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var unpopulated_field = config.test.obj_array.unpopulated_field
                var obj: T = createNewObject()
                var original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var value = getRandomValue(unpopulated_field.type)
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: unpopulated_field.name, value}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    var component = updated_obj.components[0]
                    var updated_value = getValue(component, unpopulated_field.name)
                    expect(updated_value).to.equal(value)
                })
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('+ should replace an existing field in an existing element in an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var populated_field = config.test.obj_array.populated_field
                var obj: T = createNewObject()
                var original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var replacement_obj: T = createNewObject()
                var value = getValue(replacement_obj[obj_array.name][0], populated_field.name)
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: populated_field.name, value}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    var component = updated_obj.components[0]
                    var updated_value = getValue(component, populated_field.name)
                    expect(updated_value).to.equal(value)
                })
            })
        
        })


        describe('cmd=unset ', function() {

            let cmd = 'unset'


            let _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('+ should remove an existing field from an existing element in the array', function(done) {
                var obj_array = config.test.obj_array
                var populated_field = config.test.obj_array.populated_field
                var obj: T = createNewObject()
                var original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var replacement_obj: T = createNewObject()
                var value = getValue(replacement_obj[obj_array.name][0], populated_field.name)
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id, subfield: populated_field.name}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    var component = updated_obj.components[0]
                    expect(component.info).to.exist
                    expect(component.info.quantity).to.be.undefined
                })
            })


            _it = testOrSkip({requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]]})
            _it('- should not remove or delete an existing element of an array of simple types', function(done) {
                var string_array = config.test.string_array
                var obj: T = createNewObject()
                const original_value = 'for all uses'
                obj[string_array.name] = [original_value]
                var conditions = {}
                conditions[string_array.name] = original_value
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: string_array.name, element_id: original_value}
                test_update(obj, conditions, UPDATE_CMD, (error : Error) => {
                    if (error != null) {
                        expect(error.message).to.equal('cmd=unset not allowed on array without a subfield, use cmd=remove')
                        done()
                    } else {
                        var error = new Error('unset unexpectedly succeeded')
                        done(error)
                    }
                }, () => {/* no tests */})
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('- should not remove or delete an existing element of an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var obj: T = createNewObject()
                const original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id: original_element_id}
                test_update(obj, conditions, UPDATE_CMD, (error : Error) => {
                    if (error != null) {
                        expect(error.message).to.equal('cmd=unset not allowed on array without a subfield, use cmd=remove')
                        done()
                    } else {
                        var error = new Error('unset unexpectedly succeeded')
                        done(error)
                    }
                }, () => {/* no tests */})
            })

        })


        describe('cmd=insert', function() {

            let cmd = 'insert'


            let _it = testOrSkip({requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]]})
            _it('+ should create a new element in an array of simple types', function(done) {
                var string_array = config.test.string_array
                var obj: T = createNewObject()
                const original_value = getRandomValue('string')
                obj[string_array.name] = [original_value]
                var conditions = {}
                conditions[string_array.name] = original_value
                const additional_value = getRandomValue('string')
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: string_array.name, value: additional_value}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    var array = updated_obj[string_array.name]
                    expect(array.length).to.equal(2)
                    expect(array[0]).to.equal(original_value)
                    expect(array[1]).to.equal(additional_value)
                })
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('+ should create a new element in an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var obj: T = createNewObject()
                const original_first_element = obj[obj_array.name][0]
                var original_element_id = original_first_element[obj_array.key_field]
                var path = `${obj_array.name}.${obj_array.key_field}`
                var conditions = {}
                conditions[path] = original_element_id
                var added_element = obj_array.createElement()
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, value: added_element}
                test_update(obj, conditions, UPDATE_CMD, done, (updated_obj) => {
                    var array = updated_obj[obj_array.name]
                    expect(array).to.have.lengthOf(2)
                    // didn't compare entire component via deep.equal because of _id
                    expectDBOjectToContainAllObjectFields(array[0], original_first_element)
                    expectDBOjectToContainAllObjectFields(array[1], added_element)
                })
            })

        })


        describe('cmd=remove', function() {

            let cmd = 'remove'


            let _it = testOrSkip({requires: [!!config.test.string_array], skip_if: [unsupported_array[cmd]]})
            _it('+ should remove an existing element from an array of simple types', function(done) {
                var string_array = config.test.string_array
                var obj: T = createNewObject()
                expect(obj[string_array.name]).to.have.lengthOf(1)
                var original_value = obj[string_array.name][0]
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: string_array.name, element_id: original_value}
                test_update(obj, undefined, UPDATE_CMD, done, (updated_obj) => {
                    expect(updated_obj[string_array.name]).to.have.lengthOf(0)
                })
            })


            _it = testOrSkip({requires: [!!config.test.obj_array && !!config.test.obj_array.key_field], skip_if: [unsupported_array[cmd]]})
            _it('+ should remove an existing element from an array of objects', function(done) {
                var obj_array = config.test.obj_array
                var obj: T = createNewObject()
                expect(obj[obj_array.name]).to.have.lengthOf(1)
                const first_element = obj[obj_array.name][0]
                var element_id = first_element[obj_array.key_field]
                var UPDATE_CMD : UpdateFieldCommand = {cmd, field: obj_array.name, key_field: obj_array.key_field, element_id}
                    test_update(obj, null, UPDATE_CMD, done, (updated_obj) => {
                        expect(updated_obj[obj_array.name]).to.have.lengthOf(0)
                    })
            })

        })

    })

}



// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_del<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, config: string[]): void {

    it('+ should not be able to read after delete', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                return db.del(created_obj._id).then(
                    (result) => {
                        return db.read(created_obj._id).then(
                            (read_obj) => {
                                expect(read_obj).to.not.exist
                                done()
                            }
                        )
                    }
                )
            }
        ).catch((error) => {done(error)})
    })


    it('- should return an error when the request is missing the _id', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                return db.del(undefined).then(
                    (result) => {
                        done(new Error('expected del to return error'))
                    },
                    (error) => {
                        expect(error.message).to.equal('_id is invalid')
                        done()
                    }
                )
            }
        ).catch((error) => {done(error)})
    })


    it('- should not return an error when the _id doesnt reference an object', function(done) {
        const query_id = '123456789012345678901234'
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                return db.del(query_id).then(
                    (result) => {
                        expect(result).to.not.exist
                        done()
                    }
                )
            }
        ).catch((error) => {done(error)})
    })

}


// seem to need getDB to be dynamic, otherwise DocumentDatabase is undefined!
export function test_find<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, unique_key_fieldname: string): void {

    it('+ should find an object with a matching name', function(done) {
        var db = getDB()
        var obj: T = createNewObject()
        var create_promise = db.create(obj)
        create_promise.then(
            (created_obj) => {
                const conditions = {}
                conditions[unique_key_fieldname] = obj[unique_key_fieldname]
                var find_promise = db.find(conditions)
                find_promise.then(
                    (found_objs) => {
                        expect(found_objs).to.be.instanceof(Array)
                        expect(found_objs).to.have.lengthOf(1)
                        const found_obj = found_objs[0]
                        expect(found_obj[unique_key_fieldname]).to.equal(obj[unique_key_fieldname])
                        done()
                    },
                    (error) => {
                        done(error)
                    }
                )
            },
            (error) => {
                done(error)
            }
        )
    })


    describe('cursor', function() {

        // add 20 elements to the database
        before((done) => {
            var db = getDB()
            var promises = []
            for (var i = 0 ; i < 20 ; ++i) {
                var obj: T = createNewObject()
                promises.push(db.create(obj))
            }
            Promise.all(promises).then(() => {
                done()
            })
        })


        it('should return the first item when start_offset = 0', function(done) {
            let db = getDB()
            let find_promise = db.find(undefined, undefined, undefined, {start_offset: 0})
            find_promise.then(
                (found_objs) => {
                    // cannot know which database item will be first
                    expect(found_objs[0]).to.exist
                    done()
                },
                (error) => {
                    done(error)
                }
            )
        })


        it('should default start_offset to 0', function(done) {
            let db = getDB()
            // get the first element
            db.find(undefined, undefined, undefined, {start_offset: 0}).then(
                (found_objs) => {
                    expect(found_objs[0]).to.exist
                    // save the first element
                    const first_element = found_objs[0]
                    return db.find(undefined, undefined, undefined, undefined).then(
                        (found_objs) => {
                            // confirm the default returns the first element
                            expect(found_objs[0]).to.eql(first_element)
                            done()
                        }
                    )
                }
            ).catch((error) => {done(error)})
        })


        it('should return the tenth item when start_offset = 9', function(done) {
            let db = getDB()
            db.find(undefined, undefined, undefined, {start_offset: 0, count: 10}).then(
                (found_objs) => {
                    expect(found_objs[9]).to.exist
                    const saved = found_objs
                    return db.find(undefined, undefined, undefined, {start_offset: 9}).then(
                        (found_objs) => {
                            // confirm the default returns the first element
                            expect(found_objs[0]).to.eql(saved[9])
                            done()
                        }
                    )
                }
            ).catch((error) => {done(error)})
        })


        it('should return one item if count = 1', function(done) {
            let db = getDB()
            db.find(undefined, undefined, undefined, {count: 1}).then(
                (found_objs) => {
                    expect(found_objs).to.have.lengthOf(1)
                    done()
                }
            ).catch((error) => {done(error)})
        })


        it('should default count to 10', function(done) {
            let db = getDB()
            db.find(undefined, undefined, undefined, undefined).then(
                (found_objs) => {
                    expect(found_objs).to.have.lengthOf(10)
                    done()
                }
            ).catch((error) => {done(error)})
        })


        it('should return 11 items if count = 11', function(done) {
            let db = getDB()
            db.find(undefined, undefined, undefined, {count: 11}).then(
                (found_objs) => {
                    expect(found_objs).to.have.lengthOf(11)
                    done()
                }
            ).catch((error) => {done(error)})
        })

    })

}