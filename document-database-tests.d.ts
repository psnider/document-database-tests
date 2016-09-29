import {DocumentDatabase, UpdateFieldCommand} from 'document-database-if'



// Any missing fields prevent any dependent tests from being run.
export interface Field {
    name: string 
    type: 'number' | 'string'
}


export interface Fieldnames {
    top_level?: {
        // must refer to a top-level field that is not present and supports operator "+ 1" (either a string or a number)
        populated_string?: string
        // must refer to a top-level field that is a string, and is not present
        unpopulated_string?: string
        string_array?: {
            name: string
        }
        obj_array?: {
            name: string
            key_field: string
            populated_field: Field
            unpopulated_field: Field
            createElement: () => {}   // 2 sequential calls must return different results
        }
    }
}

export function test_create<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, fieldnames: string[]): void
export function test_read<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, fieldnames: string[]): void
export function test_replace<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, fieldnames: string[]): void
export function test_update<T extends {_id?: string}>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, fieldnames: Fieldnames): void
export function test_del<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, fieldnames: string[]): void
export function test_find<T>(getDB: () => DocumentDatabase<T>, createNewObject: () => T, unique_key_fieldname: string): void
