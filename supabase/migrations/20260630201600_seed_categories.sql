-- V1 starter categories (5 categories x 10 words). Expand toward spec's ~10x30 later.
insert into categories (name) values
  ('Sports'), ('Food'), ('Movies'), ('Animals'), ('Travel');

insert into words (category_id, text)
select id, w from categories, unnest(array[
  'Basketball','Soccer','Tennis','Golf','Swimming','Boxing','Baseball','Hockey','Surfing','Skiing'
]) as w where name = 'Sports'
union all
select id, w from categories, unnest(array[
  'Pizza','Sushi','Tacos','Burger','Pasta','Ramen','Salad','Steak','Pancakes','Curry'
]) as w where name = 'Food'
union all
select id, w from categories, unnest(array[
  'Titanic','Jaws','Inception','Frozen','Gladiator','Avatar','Up','Coco','Joker','Cars'
]) as w where name = 'Movies'
union all
select id, w from categories, unnest(array[
  'Elephant','Penguin','Giraffe','Kangaroo','Octopus','Dolphin','Tiger','Panda','Eagle','Fox'
]) as w where name = 'Animals'
union all
select id, w from categories, unnest(array[
  'Paris','Tokyo','Cairo','Sydney','Rome','Bali','Iceland','Venice','Dubai','Peru'
]) as w where name = 'Travel';
