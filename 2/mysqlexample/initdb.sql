DROP DATABASE IF EXISTS testdb;

CREATE DATABASE testdb;

USE testdb;

CREATE TABLE test_table (
	id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
	test_field TEXT NOT NULL
);

INSERT INTO test_table(test_field) VALUES ('prova');
