# OCI container files

* Directory [_mysqlexample_](mysqlexample) contains an SQL file that initializes a very simple database, meant to be used with `docker exec -i <container_name> mysql -u<username> -p<password> <db_name> < initdb.sql` to demonstrate stdin redirection with docker exec and how to perform basic maintenance and deployment tasks on OCI containers.
* Directory [_nginxexample_](nginxexample) contains files meant to demonstrate simple OCI container image creation.
* Directory [_composeexample_](composeexample) contains files meant to show how to use Compose to simplify multi-container application deployment.
* Directory [_morraflask_](morraflask) contains files meant to show how to containerize the [morra-flask](https://github.com/BiagioeCarmine/morra-flask) example multi-container application.
