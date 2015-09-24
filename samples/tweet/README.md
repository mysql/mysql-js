# Sample Application

### The Tweet Demo

This directory contains a Twitter-like demo application using
Database Jones.

The SQL script create_tweet_tables.sql contains DDL statements for MySQL
to create the five tables used by the demo application.  It can be executed
using the standard mysql command:

    mysql -u root < create_tweet_tables.sql

The Node.js application *tweet.js* is a rather complete large example which
can run as either as a command-line tool or as a REST web server.  Some
demonstration scripts are provided to illustrate *tweet.js*:

- *demo_cli_populate.sh* populates the database with some sample data.
- *demo_cli_get.sh* demonstrates querying the sample data from the command shell.
- *demo_http_get.sh* demonstrates querying the sample data (and posting a new
tweet) over the HTTP interface.
- *demo_http_delete.sh* uses the HTTP interface to delete the sample data.

Note that in order to run the HTTP demo scripts, you must first start the
server on port 7800, using the command:

    node tweet start server 7800


### The API example code

Because tweet.js is quite complex, we have also included some simple
code examples illustrating the Jones APIs.

- *find.js* illustrates using session.find() to retreive a single record from a
table.
- *insert.js* illustrates using session.persist() to store a record.
- *scan.js* illustrates using session.createQuery() to build and execute a query
that returns multiple records.
- *join.js* illustrates using a Projection to define a relationship between
tables, and then running session.find() against the projection.  The equivalent
query in SQL would be a join.


### Connecting to a database server in your environment

Jones applications connect to a particular database using a
named **deployment** defined in the file *jones_deployments.js*.  The sample
code uses the "test" deployment. You can customize jones_deployments.js for
your environment, and you can supply a different deployment as a command-line
option in tweet.js or by editing the call to ConnectionProperties() in the
API samples.


