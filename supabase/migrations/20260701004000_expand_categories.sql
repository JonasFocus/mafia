-- Expand from 5 to 25 categories, skewed toward a 20-something audience.
insert into categories (name) values
  ('Fast Food'), ('Coffee Orders'), ('Dating Apps'), ('Reality TV'), ('Rappers'),
  ('Pop Stars'), ('Sitcoms'), ('Video Games'), ('Social Media Apps'), ('Sneakers'),
  ('Superheroes'), ('Anime'), ('Horror Movies'), ('Drinking Games'), ('College Life'),
  ('Gym & Fitness'), ('Road Trip'), ('Music Festivals'), ('Late-Night Snacks'), ('Celebrities');

insert into words (category_id, text)
select id, w from categories, unnest(array[
  'McDonald''s','Chipotle','Taco Bell','In-N-Out','Wendy''s','Chick-fil-A','Popeyes','Five Guys','Shake Shack','Panda Express','Subway','Raising Cane''s','Whataburger','Jack in the Box','Dunkin'
]) as w where name = 'Fast Food'
union all
select id, w from categories, unnest(array[
  'Iced Latte','Cold Brew','Cappuccino','Americano','Espresso Shot','Frappuccino','Matcha Latte','Oat Milk Latte','Pumpkin Spice Latte','Nitro Cold Brew','Flat White','Mocha','Chai Latte','Drip Coffee','Affogato'
]) as w where name = 'Coffee Orders'
union all
select id, w from categories, unnest(array[
  'Tinder','Hinge','Bumble','Grindr','OkCupid','Coffee Meets Bagel','The League','Raya','Feeld','Match','Plenty of Fish','Happn','HER','Facebook Dating','Snapchat'
]) as w where name = 'Dating Apps'
union all
select id, w from categories, unnest(array[
  'Love Island','The Bachelor','Big Brother','Survivor','Jersey Shore','Real Housewives','Too Hot to Handle','Love Is Blind','RuPaul''s Drag Race','The Circle','Below Deck','Vanderpump Rules','Selling Sunset','Married at First Sight','Are You the One'
]) as w where name = 'Reality TV'
union all
select id, w from categories, unnest(array[
  'Drake','Kendrick Lamar','Travis Scott','Cardi B','Kanye West','Nicki Minaj','Post Malone','J. Cole','Lil Wayne','Megan Thee Stallion','Tyler the Creator','Doja Cat','21 Savage','Future','SZA'
]) as w where name = 'Rappers'
union all
select id, w from categories, unnest(array[
  'Taylor Swift','Ariana Grande','Beyoncé','Billie Eilish','Dua Lipa','Olivia Rodrigo','Harry Styles','The Weeknd','Justin Bieber','Rihanna','Sabrina Carpenter','Bruno Mars','Selena Gomez','Katy Perry','Miley Cyrus'
]) as w where name = 'Pop Stars'
union all
select id, w from categories, unnest(array[
  'Friends','The Office','Brooklyn Nine-Nine','Parks and Recreation','How I Met Your Mother','New Girl','It''s Always Sunny','Community','Seinfeld','The Big Bang Theory','Modern Family','Superstore','Abbott Elementary','Ted Lasso','Schitt''s Creek'
]) as w where name = 'Sitcoms'
union all
select id, w from categories, unnest(array[
  'Fortnite','Minecraft','Call of Duty','League of Legends','Valorant','Animal Crossing','Among Us','Overwatch','Mario Kart','Roblox','Apex Legends','Zelda','GTA','FIFA','The Sims'
]) as w where name = 'Video Games'
union all
select id, w from categories, unnest(array[
  'Instagram','TikTok','Snapchat','Twitter','BeReal','Discord','Pinterest','Reddit','LinkedIn','YouTube','Threads','WhatsApp','Facebook','Twitch','Venmo'
]) as w where name = 'Social Media Apps'
union all
select id, w from categories, unnest(array[
  'Air Jordans','Yeezys','Air Force 1s','Chuck Taylors','Vans Old Skools','New Balance 550s','Dunks','Crocs','Adidas Sambas','Birkenstocks','Ugg Boots','Doc Martens','Jordan 4s','On Cloud','Hoka Bondi'
]) as w where name = 'Sneakers'
union all
select id, w from categories, unnest(array[
  'Spider-Man','Batman','Iron Man','Wonder Woman','Superman','The Hulk','Deadpool','Black Panther','Captain America','Thor','Wolverine','Black Widow','Aquaman','Doctor Strange','Scarlet Witch'
]) as w where name = 'Superheroes'
union all
select id, w from categories, unnest(array[
  'Naruto','One Piece','Attack on Titan','My Hero Academia','Demon Slayer','Dragon Ball Z','Death Note','Jujutsu Kaisen','Spirited Away','Fullmetal Alchemist','Tokyo Ghoul','One Punch Man','Sailor Moon','Pokemon','Cowboy Bebop'
]) as w where name = 'Anime'
union all
select id, w from categories, unnest(array[
  'Scream','Halloween','Get Out','The Conjuring','It','Hereditary','A Quiet Place','Saw','The Exorcist','Nightmare on Elm Street','Us','Midsommar','Insidious','Paranormal Activity','Chucky'
]) as w where name = 'Horror Movies'
union all
select id, w from categories, unnest(array[
  'Beer Pong','Flip Cup','Kings Cup','Never Have I Ever','Beer Die','Quarters','Ring of Fire','Truth or Drink','Power Hour','Slap Cup','Civil War','Landmines','Chandelier','Boat Race','Waterfall'
]) as w where name = 'Drinking Games'
union all
select id, w from categories, unnest(array[
  'Dorm Room','Frat Party','Finals Week','Meal Swipe','Spring Break','Office Hours','Ramen Noodles','Group Project','All-Nighter','Homecoming','Tailgate','Syllabus Week','Textbook','Student Loan','Sorority Rush'
]) as w where name = 'College Life'
union all
select id, w from categories, unnest(array[
  'Deadlift','Bench Press','Protein Shake','Leg Day','Treadmill','Squat Rack','Pre-Workout','Yoga Mat','HIIT Class','Gym Selfie','Cardio','Spin Class','Foam Roller','Creatine','Pull-Up Bar'
]) as w where name = 'Gym & Fitness'
union all
select id, w from categories, unnest(array[
  'Gas Station Snacks','Aux Cord','Rest Stop','License Plate Game','GPS','Road Trip Playlist','Backseat Nap','Speeding Ticket','Drive-Thru','Car Sickness','Toll Booth','Bumper Sticker','Convertible','Carpool Karaoke','Sunset Drive'
]) as w where name = 'Road Trip'
union all
select id, w from categories, unnest(array[
  'Coachella','Lollapalooza','EDC','Bonnaroo','Camping Tent','Festival Wristband','Mosh Pit','Main Stage','Glitter Makeup','Crowd Surf','Food Truck','Fanny Pack','Flower Crown','Sunscreen','VIP Pass'
]) as w where name = 'Music Festivals'
union all
select id, w from categories, unnest(array[
  'Pizza Rolls','Ramen','Cereal','Nachos','Ice Cream','Mozzarella Sticks','Hot Pockets','Popcorn','Chips and Salsa','Grilled Cheese','Leftover Takeout','Cookie Dough','Instant Noodles','Quesadilla','Trail Mix'
]) as w where name = 'Late-Night Snacks'
union all
select id, w from categories, unnest(array[
  'Kim Kardashian','Zendaya','Timothée Chalamet','Dwayne Johnson','Ryan Reynolds','Margot Robbie','Tom Holland','Jennifer Lawrence','Chris Hemsworth','Emma Watson','Will Smith','Kevin Hart','Kylie Jenner','Pete Davidson','Elon Musk'
]) as w where name = 'Celebrities';
