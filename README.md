# document-database-tests

Tests for a generic document (no-SQL) database, [DocumentDatabase](https://github.com/psnider/document-database-if)

These tests can be reused for any object that implements DocumentDatabase<T>.
The tests can be configured for use with a specfic DocumentDatabase<T>.

For example, see the the test usage in [MongoDBAdaptor<T>](https://github.com/psnider/mongodb-adaptor/blob/master/test/ts/MongoDBAdaptor.tests.ts#L338-L382)
