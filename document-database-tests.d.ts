import {DocumentDatabase, DocumentID, UpdateFieldCommand} from 'document-database-if'



// Any missing fields prevent any dependent tests from being run.
export interface Field {
    name: string 
    type: 'number' | 'string'
}

export interface FieldsUsedInTests {
    // must refer to a top-level field that is not present and supports operator "+ 1" (either a string or a number)
    populated_string?: string
    // must refer to a top-level field that is a string, and is not present
    unpopulated_string?: string
    string_array?: {
        name: string
    }
    obj_array?: {
        name: string
        key_field?: string
        populated_field: Field
        unpopulated_field?: Field
        createElement: () => {}   // 2 sequential calls must return different results
    }
}

export interface UnsupportedUpdateObjectCmds {
    set: boolean 
    unset: boolean
}

export interface UnsupportedUpdateArrayCmds {
    set: boolean 
    unset: boolean
    insert: boolean
    remove: boolean
}

export interface UnsupportedUpdateCmds {
    object?: UnsupportedUpdateObjectCmds
    array?: UnsupportedUpdateArrayCmds
}

export interface UpdateConfiguration {
    // controls which tests are skipped due to the object type not having the data type required by a test
    test: FieldsUsedInTests,
    // controls which tests are skipped due to missing support
    unsupported?: UnsupportedUpdateCmds
}

export function test_create<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, fieldnames: string[]): void
export function test_read<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, fieldnames: string[]): void
export function test_replace<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, fieldnames: string[]): void
export function test_update<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, config: UpdateConfiguration): void
export function test_del<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, fieldnames: string[]): void
export function test_find<DocumentType extends {_id?: DocumentID}>(getDB: () => DocumentDatabase, createNewObject: () => DocumentType, unique_key_fieldname: string): void
