// Dig Through Worlds: the helpers' names, stories and things they say (DTWStory). Words only, no logic: the rules for
// hearts, perks and when a story part is told are in js/logic.js (FRIENDS). Lines are short and plain so they can be
// read aloud to a 6 to 9 year old. friends[k] goes with DTW.FRIENDS[k].
var DTWStory = (function () {
  'use strict';
  // the hero: Nim, a 6 year old boy; his name is used in the friends' lines
  var HERO = 'Nim';
  // a line that starts with 💨 is one of Baron's toots: ui.js plays a toot sound and a little green puff with it
  var friends = [
    { name: 'Baron', who: "Nim's big brother, age 9", icon: '💨',
      about: 'Strong, silly and proud of it. Baron tries to act cool, but his tummy always gives him away.',
      perk: 'Big Brother Muscles', perkText: 'Baron hits his blocks 50% harder.',
      voice: { pitch: 0.8, rate: 0.95 },
      meet: 'Hey Nim! Mum says I have to help you dig. Fine. But I am in charge of the big rocks.',
      wait: '',
      story: [
        'I am not scared of the dark. I just like to stay close to your lamp. For you. Not for me.',
        '💨 Excuse me! That was the ground. Ground toots are very common down here. Ask any scientist.',
        'Remember when you found that worm and cried because it was sad? I did not laugh. Okay, a little.',
        'You are a really good digger, Nim. Better than me. Do not tell anyone I said that.'
      ],
      chat: ['💨 Oops. Beans for breakfast.', 'Watch this muscle! Okay, it is small. It is growing.', 'Did you hear that? It was not me. It was a mole.', 'I can carry two rocks at once. Three if nobody is looking.', 'Hale bossed me around all morning. Help.'],
      gift: 'Iron? For me? That is so cool. I mean, thanks. It is fine. It is great!',
      lines: { critter: ['💨 Shoo! Smell that, bat!', '💨 Take that, bony! Ha!', 'I am not scared. You are scared!'], fossil: ['Whoa! A bone! I saw it first!', '💨 Sorry, I got excited. A bone!'], trap: ['Ugh, dizzy! And now I need the toilet.'], full: ['💨 The bag is full. And so am I. Up we go!'], party: ['💨 Party toot! Hooray!', 'We are the best diggers ever!'], up: ['You are an okay little brother. A GREAT one, actually.'], hello: ['Hey Nim!', '💨 Hi. That was a hello toot.'] } },
    { name: 'Hale', who: "Nim's little sister, age 4", icon: '🎀',
      about: 'Full of hugs and full of orders. Hale loves everybody, and she will tell everybody what to do.',
      perk: 'Bossy Boots', perkText: 'Hale tells you to hurry: you swing 15% faster.',
      voice: { pitch: 1.6, rate: 1.1 },
      meet: 'Nim! I am coming too! No, you can not say no. I already have my hat on. Hug first, then dig.',
      wait: 'Hale wants to dig too! When Baron is your good friend (♥♥), he will bring her down.',
      story: [
        'I love you, Nim. Now dig that one. No, THAT one. Good job!',
        'Baron says I am bossy. I am not bossy. I am the boss. That is different.',
        'When you went down the ladder alone, I was worried. So now I come. That is the rule.',
        'You are my favourite. Do not tell Baron. Okay, tell him. He knows. Group hug!'
      ],
      chat: ['Faster, Nim! Dig dig dig!', 'I made a rule. No sad faces in the pit.', 'Baron! Stop tooting! It is RUDE.', 'Can I have a hug? Thank you. Now get back to work.', 'Copper is my colour. It is the boss colour.'],
      gift: 'Copper! You are the best! Hug! Okay, that is enough hug. Back to work.',
      lines: { critter: ['Hey! Go away! This is OUR pit!', 'No bats allowed! Shoo!', 'Bad bones! Say sorry!'], fossil: ['A bone! I said there was one there!', 'Good digging! I am proud of you!'], trap: ['Hey! Who put that trap there? Rude!'], full: ['The bag is full! Go up! Now, please!'], party: ['Yay! Everybody hug!'], up: ['I love you sooo much!'], hello: ['Nim! Over here!', 'Hug, then dig!'] } },
    { name: 'Jon', who: 'Big friendly merman from the Sunken Ocean', icon: '🐟',
      about: 'A huge, gentle grown-up who trips over his own tail. Jon is not very clever, but he is very kind.',
      perk: 'Big Lungs', perkText: 'Jon blows extra bubbles: your oxygen lasts 50% longer.',
      voice: { pitch: 0.6, rate: 0.8 },
      meet: 'Oh, hello little diggers! I am Jon. I am very good at holding my breath. And bad at most other things. Can I help?',
      wait: '',
      story: [
        'I tried to count all the fish once. I got to seven. Then I forgot what came after seven.',
        'Sometimes I sit on a sea turtle by mistake. They do not mind. Turtles are very nice.',
        'Nobody ever asked me to help before. They said I was too clumsy. You asked. That made me happy.',
        'You are my best friends in the whole wet world. Even Baron. Even when he toots in the bubbles.'
      ],
      chat: ['Is it lunch? It feels like lunch.', 'I bumped my head on a rock. The rock is fine.', 'Crystals are so pretty. Like little frozen bubbles.', 'Whoops! Sorry. That was my tail.', 'Hale says I am a good boy. I like Hale.'],
      gift: 'A crystal! Oh, it is so sparkly. I will try very hard not to lose it.',
      lines: { critter: ['Oops, I bumped my head. Hello, little bat!', 'Shoo, please! Sorry! Shoo!', 'Rattle rattle? I can rattle too!'], fossil: ['Ooh, a bone! Is it mine? No? Okay.', 'Wow! A big old bone!'], trap: ['Uh oh. Everything is going round and round.'], full: ['The bag is full! I can carry you up if you like.'], party: ['Yaaay! I am so happy I could cry!'], up: ['You are so nice to me!'], hello: ['Hello, little friends!', 'Oh! Hi! I was having a nap.'] } },
    { name: 'Wren', who: 'Jungle kid from the Ruins', icon: '🌿',
      about: 'Wild, quick and fearless. Wren grew up in the old temple and talks to the monkeys.',
      perk: 'Trap Sense', perkText: 'Wren spots traps: you get twice as long to jump clear.',
      voice: { pitch: 1.25, rate: 1.2 },
      meet: 'Hey! You want to dig in my jungle? Watch out, there are traps everywhere. I can show you!',
      story: [
        'The monkeys taught me to climb. The parrots taught me to whistle. You are teaching me to dig!',
        'The temple was built by people long ago. They loved the jaguar. Like me!',
        'Sometimes I am lonely in the big jungle. Not now. Now I have friends.',
        'You are brave like a jaguar, Nim. I made you a jungle name. It means best friend.'
      ],
      chat: ['Shh! A monkey is watching us.', 'Gold is the colour of jaguar eyes!', 'When a trap goes click, you jump!', 'I swing on vines. Whee!', 'Mud is good for hiding. And for fun.'],
      gift: 'Gold! Shiny like the jaguar idol! You are so nice!',
      lines: { critter: ['I am not scared! Tap it!', 'Ha! Come here, bat! I am brave!', 'Shake those bones away!'], fossil: ['A bone! Is it a big cat?', 'Ooh, a really old bone!'], trap: ['Click! Ow, I am dizzy!'], full: ['The bag is full! Let us climb up!'], party: ['Jaguar dance! Woo!'], up: ['You are the best friend in the jungle!'], hello: ['Hey hey!', 'Jungle time!'] } },
    { name: 'Nova', who: 'Junior astronaut on the Moon', icon: '🚀',
      about: 'Smart and exact. Nova counts everything and dreams of flying to the stars.',
      perk: 'Moon Grabber', perkText: 'Nova catches bouncy finds: you pick up from 1 cell further.',
      voice: { pitch: 1.3, rate: 1.0 },
      meet: 'Hello! Nova here, junior astronaut. My rover got lost on the Moon. Help me find it?',
      story: [
        'I trained for 3 years to be an astronaut. That is 1,095 days. I counted.',
        'My rover is called Sparky. It has 6 wheels and a little flag. I miss it.',
        'From the Moon, Earth looks like a blue marble. Your house is down there somewhere!',
        'Mission report: Nim is the best friend in the whole galaxy. Mission complete!'
      ],
      chat: ['On the Moon you weigh much less. Boing!', 'Iron is great for rocket parts.', 'Countdown to digging: 3, 2, 1, dig!', 'There is no wind on the Moon. Footprints stay forever!', 'I can see 10 stars. No, 11!'],
      gift: 'Iron! Perfect for fixing Sparky. Thank you, crew mate!',
      lines: { critter: ['Critter spotted. Tap to shoo!', 'Bat detected! Tap it!', 'Skeleton coming. Three taps!'], fossil: ['Fossil detected!', 'A space bone? Amazing!'], trap: ['Systems dizzy!'], full: ['Cargo bay full. Return to base!'], party: ['Mission success!'], up: ['Friendship level rising!'], hello: ['Nova reporting!', 'Ready for launch!'] } },
    { name: 'Grog', who: 'Shy alien from Planet Glorp', icon: '👾',
      about: 'Very quiet and very timid. Grog hides behind rocks, but once Grog trusts you, Grog is the kindest friend there is.',
      perk: 'Quiet Nose', perkText: 'Grog quietly sniffs out fossils: everyone breaks bone blocks twice as fast.',
      voice: { pitch: 1.4, rate: 0.75 },
      meet: '...hello. I am Grog. Sorry. Is it okay if I dig... a little bit? Near you?',
      wait: '',
      story: [
        '...you did not laugh at my antennas. Thank you. Most people laugh.',
        'Loud noises scare me. Baron is very loud. But... his toots are a little bit funny.',
        'On Glorp I had no friends. I talked to the goo. The goo did not talk back.',
        'Nim... can I say something? You are my first friend. ...That is all. Sorry. Thank you.'
      ],
      chat: ['...hi.', '...I found a pebble. It is for you. If you want.', 'Hale hugged me. I did not know what to do. It was nice.', '...shh. The goo is sleeping.', '...coal tastes like candy. Do not tell anyone.'],
      gift: '...for me? Coal? ...thank you. I will save it. Maybe I will eat it.',
      lines: { critter: ['...eek. ...is it gone?', '...a bat. ...I will hide.', '...bones walking. ...nope.'], fossil: ['...oh. A bone. Here.', '...sniff sniff. Found one.'], trap: ['...eek.'], full: ['...the bag is full. Sorry.'], party: ['...yay! ...YAY!'], up: ['...you are my friend. Thank you.'], hello: ['...hi.', '...oh. Hello.'] } }
  ];
  var HEART_NAMES = ['New friend', 'Pal', 'Good friend', 'Close friend', 'Best friend'];
  return { hero: HERO, friends: friends, HEART_NAMES: HEART_NAMES };
})();
