use test;
DROP TABLE if EXISTS towns2;
DROP TABLE if EXISTS int_after_blob;

CREATE TABLE `towns2` (
  `town` varchar(50) NOT NULL,
  `county` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`town`)
);

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
