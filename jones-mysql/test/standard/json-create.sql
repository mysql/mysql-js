use test;
drop table if exists json_freeform;
create table if not exists json_freeform (
  id int not null AUTO_INCREMENT,
  SPARSE_FIELDS JSON,
  primary key(id)
);

insert into json_freeform(id, SPARSE_FIELDS) values(1, '{"name": "Name 1", "number": 1, "a": [{"a10": "a10"}, {"a11": "a11"}]}');
insert into json_freeform(id, SPARSE_FIELDS) values(2, '{"name": "Name 2", "number": 2, "a": [{"a20": "a20"}, {"a21": "a21"}]}');

drop table if exists json_semistruct;
create table if not exists json_semistruct (
  id int not null AUTO_INCREMENT,
  name varchar(30),
  number int,
  SPARSE_FIELDS JSON,
  primary key(id)
);

insert into json_semistruct(id, name, number, SPARSE_FIELDS) values(1, "Name 1", 1, '{"a": [{"a10": "a10"}, {"a11": "a11"}]}');
insert into json_semistruct(id, name, number, SPARSE_FIELDS) values(2, "Name 2", 2, '{"a": [{"a20": "a20"}, {"a21": "a21"}]}');

drop table if exists json_hybrid;
create table if not exists json_hybrid (
  id int not null AUTO_INCREMENT,
  unstruct_json JSON,
  unstruct_varchar varchar(4000),
  SPARSE_FIELDS JSON,
  primary key(id)
);

