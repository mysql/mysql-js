use test;
create table if not exists charset_test (
  id int not null PRIMARY KEY,
  str_fix_latin1 CHAR(20) character set latin1,
  str_var_latin1 VARCHAR(20) character set latin1,
  str_fix_latin2 CHAR(20) character set latin2,
  str_var_latin2 VARCHAR(20) character set latin2,
  str_fix_utf8  CHAR(20) character set utf8,
  str_var_utf8  VARCHAR(20) character set utf8,
  str_fix_utf16 CHAR(20) character set utf16,
  str_var_utf16 VARCHAR(20) character set utf16,
  str_fix_ascii CHAR(20) character set ascii,
  str_var_ascii VARCHAR(20) character set ascii,
  str_fix_utf32 CHAR(20) character set utf32,
  str_var_utf32 VARCHAR(20) character set utf32  
);

create table if not exists binary_test (
  id int not null PRIMARY KEY,
  bin_fix BINARY(20),
  bin_var VARBINARY(200),
  bin_var_long VARBINARY(2000),
  bin_lob BLOB
);

create table if not exists text_blob_test ( 
  id int not null primary key,
  blob_col BLOB,
  text_col TEXT character set utf8
);

create table if not exists text_charset_test (
  id int not null primary key,
  ascii_text TEXT character set ascii,
  latin1_text TEXT character set latin1,
  utf16_text TEXT character set utf16
);

delete from charset_test;
delete from binary_test;
delete from text_blob_test;
delete from text_charset_test;

DROP TABLE if EXISTS int_after_blob;

CREATE TABLE int_after_blob (
  id int unsigned not null primary key,
  text_col text,
  int_col int
);

insert into int_after_blob
  VALUES (1, "Whose woods these are I think I know.", 1),
         (2, "His house is in the village though;", 2),
         (3, "He will not see me stopping here", 3),
         (4, "To watch his wood fill up with snow", 4),
         (5, NULL, 5),
         (6, "My little horse must think it queer", 6),
         (7, "To stop without a farmhouse near", 7),
         (8, "Between the woods and frozen lake", 8),
         (9, "The darkest evening of the year.", 9);

