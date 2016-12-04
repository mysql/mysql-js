use test;
drop table if exists mappings_freeform;
drop table if exists mappings_semistruct;
drop table if exists mappings_basic;

create table if not exists mappings_freeform (
  id int not null AUTO_INCREMENT,
  SPARSE_FIELDS varchar(2000) CHARACTER SET "UTF8",
  primary key(id)
);

insert into mappings_freeform(id, SPARSE_FIELDS) values(1, '{"name": "Name 1", "number": 1, "a": [{"a10": "a10"}, {"a11": "a11"}]}');
insert into mappings_freeform(id, SPARSE_FIELDS) values(2, '{"name": "Name 2", "number": 2, "a": [{"a20": "a20"}, {"a21": "a21"}]}');

create table if not exists mappings_semistruct (
  id int not null AUTO_INCREMENT,
  name varchar(30),
  number int,
  SPARSE_FIELDS varchar(1000) CHARACTER SET "UTF8",
  primary key(id)
);

insert into mappings_semistruct(id, name, number, SPARSE_FIELDS) values(1, "Name 1", 1, '{"a": [{"a10": "a10"}, {"a11": "a11"}]}');
insert into mappings_semistruct(id, name, number, SPARSE_FIELDS) values(2, "Name 2", 2, '{"a": [{"a20": "a20"}, {"a21": "a21"}]}');

create table if not exists mappings_basic (
  id int not null,
  name varchar(32) default 'Employee 666',
  age int,
  magic int not null,
  primary key(id),

  unique key idx_unique_hash_magic (magic) using hash,
  key idx_btree_age (age)
);
insert into mappings_basic values(0, 'Employee 0', 0, 0);
insert into mappings_basic values(1, 'Employee 1', 1, 1);
insert into mappings_basic values(2, 'Employee 2', 2, 2);
insert into mappings_basic values(3, 'Employee 3', 3, 3);
insert into mappings_basic values(4, 'Employee 4', 4, 4);
insert into mappings_basic values(5, 'Employee 5', 5, 5);
insert into mappings_basic values(6, 'Employee 6', 6, 6);
insert into mappings_basic values(7, 'Employee 7', 7, 7);
insert into mappings_basic values(8, 'Employee 8', 8, 8);
insert into mappings_basic values(9, 'Employee 9', 9, 9);
