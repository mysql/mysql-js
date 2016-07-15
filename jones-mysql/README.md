Jones-MySQL
===========

Introduction
------------
Jones-MySQL is the Database Jones service provider for MySQL.

It supports any MySQL database and uses the all-JavaScript mysql
connector https://github.com/felixge/node-mysql


Running and Testing Jones-MySQL 
-------------------------------

### Running the test suite

To test that jones-mysql is fully installed:
+ `cd test`
+ By default, jones-mysql uses a MySQL servers at port 3306 on the local machine. In this case:
    + `node driver`
+ For some other configuration, define a deployment with appropriate connection properties in [jones_deployments.js](../jones_deployments.js) and use it:
    + `node driver -E my_test_deployment`

#### Test results

The final output from a succesful test run should look something like this:

```
Adapter:  mysql
Elapsed:  8.395 sec.
Started:  619
Passed:   617
Failed:   0
Skipped:  2
```


NDB Connection Properties
-------------------------
Each Jones Service Provider supports a different set of connection properties, based on the data source it supports.  These properties, and their default values, are documented in the file [DefaultConnectionProperties.js](DefaultConnectionProperties.js)
 



