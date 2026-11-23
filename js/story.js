// Dig Through Worlds: the helpers' names, stories and things they say (DTWStory). Words only, no logic: the rules for
// hearts, perks and when a story part is told are in js/logic.js (FRIENDS). Lines are short and plain so they can be
// read aloud to a 6 to 9 year old. friends[k] goes with DTW.FRIENDS[k].
var DTWStory = (function () {
  'use strict';
  var friends = [
    { name: 'Theo', who: 'Big kid from town, age 11', icon: '🪨',
      about: 'Careful, kind and full of rock facts. He worries a bit, but he never gives up.',
      perk: 'Strong Arm', perkText: 'Theo hits his blocks 50% harder.',
      voice: { pitch: 0.85, rate: 0.95 },
      meet: 'Hi! I am Theo. My grandpa was a digger. This was his pick! Can I help you dig?',
      story: [
        'Grandpa told me the forest is full of old bones. He said the best digs need a good friend.',
        'I get scared of the dark sometimes. But your lamp is really bright. I feel brave with you.',
        'Grandpa found a mammoth tooth once. He gave it to the museum. Now we are filling it up together!',
        'Grandpa would be so proud of us. You are the best digging partner ever. Thanks for being my friend.'
      ],
      chat: ['Did you know? Coal is made from very old plants!', 'Iron is my favourite. It makes strong tools.', 'Let me check the walls. Safety first!', 'I like the sound of a pick on stone. Clink, clink!', 'My sister Pip wants to dig too. She is really loud.'],
      gift: 'Iron! Wow, thank you! I will keep this one forever.',
      lines: { fossil: ['A bone! Careful now.', 'Look at that! A real fossil!'], trap: ['Oof! That made me dizzy.'], full: ['The bag is full! Time to go up.'], party: ['We did it! We did it!'], up: ['You are a great friend!'], hello: ['Hi! Ready to dig?', 'Good to see you!'] } },
    { name: 'Pip', who: "Theo's little sister, age 5", icon: '🎀',
      about: 'Loud, brave and bouncy. Everything is the BEST thing ever. She loves shiny things.',
      perk: 'Cheer Squad', perkText: 'Pip cheers you on: you swing 15% faster.',
      voice: { pitch: 1.6, rate: 1.1 },
      meet: 'I am Pip! I am five! Theo said I can dig too! Is that a worm? I love worms!',
      story: [
        'Theo says I am too little. But I can dig SO fast. Watch me!',
        'I keep my shiny pebbles in my sock. This one is my best one. You can hold it.',
        'When I grow up I want to be a digger like you. And a dinosaur. Both!',
        'You are my best friend. Theo is my best brother. We are a team!'
      ],
      chat: ['I found a shiny! Oh wait, it is a pebble. Still shiny!', 'Dig dig dig dig dig!', 'Can we find a T. rex today? Please?', 'Copper is orange like my hair!', 'I am not tired. I am never tired!'],
      gift: 'Copper! It is so shiny! I will put it in my sock!',
      lines: { fossil: ['A BONE! A BONE!', 'Dinosaur! Is it a dinosaur?'], trap: ['Whoa! Everything is spinning!'], full: ['The bag is all full up!'], party: ['Yay yay yay!'], up: ['I love you! You are the best!'], hello: ['Hi hi hi!', 'Let us go dig!'] } },
    { name: 'Marlo', who: 'Merkid from the Sunken Ocean', icon: '🐚',
      about: 'Calm and dreamy. Marlo hums sea songs and can hold a breath for a very long time.',
      perk: 'Bubble Breath', perkText: 'Marlo shares bubbles: your oxygen lasts 50% longer.',
      voice: { pitch: 1.15, rate: 0.85 },
      meet: 'Hello, land friend. I am Marlo. The sea floor hides many secrets. Shall we dig together?',
      story: [
        'My family sings to the whales at night. The songs help lost fish find home.',
        'A long time ago, a giant turtle swam here. Her bones are still sleeping in the sand.',
        'The Tide Pearl Crown belonged to the first merfolk queen. I am glad you will keep it safe.',
        'You are welcome in the ocean any time. You are family now.'
      ],
      chat: ['Listen. Can you hear the sea humming?', 'Bubbles are the ocean saying hello.', 'Sea glass looks like crystal. I collect both.', 'Sharks are not scary. They are just shy.', 'Breathe slowly. Like a sleepy fish.'],
      gift: 'A crystal! It sparkles like moonlight on the waves. Thank you.',
      lines: { fossil: ['Ahh, an old friend from the deep.', 'A sea bone. How lovely.'], trap: ['Oh! My head is going round.'], full: ['The bag is full. Let us swim up.'], party: ['Hooray! The whales will sing for us!'], up: ['My heart is happy, like a dolphin!'], hello: ['Hello, friend.', 'The tide is good today.'] } },
    { name: 'Wren', who: 'Jungle kid from the Ruins', icon: '🌿',
      about: 'Wild, quick and fearless. Wren grew up in the old temple and talks to the monkeys.',
      perk: 'Trap Sense', perkText: 'Wren spots traps: you get twice as long to jump clear.',
      voice: { pitch: 1.25, rate: 1.2 },
      meet: 'Hey! You want to dig in my jungle? Watch out, there are traps everywhere. I can show you!',
      story: [
        'The monkeys taught me to climb. The parrots taught me to whistle. You are teaching me to dig!',
        'The temple was built by people long ago. They loved the jaguar. Like me!',
        'Sometimes I am lonely in the big jungle. Not now. Now I have friends.',
        'You are brave like a jaguar. I made you a jungle name. It means best friend.'
      ],
      chat: ['Shh! A monkey is watching us.', 'Gold is the colour of jaguar eyes!', 'When a trap goes click, you jump!', 'I swing on vines. Whee!', 'Mud is good for hiding. And for fun.'],
      gift: 'Gold! Shiny like the jaguar idol! You are so nice!',
      lines: { fossil: ['A bone! Is it a big cat?', 'Ooh, a really old bone!'], trap: ['Click! Ow, I am dizzy!'], full: ['The bag is full! Let us climb up!'], party: ['Jaguar dance! Woo!'], up: ['You are the best friend in the jungle!'], hello: ['Hey hey!', 'Jungle time!'] } },
    { name: 'Nova', who: 'Junior astronaut on the Moon', icon: '🚀',
      about: 'Smart and exact. Nova counts everything and dreams of flying to the stars.',
      perk: 'Moon Grabber', perkText: 'Nova catches bouncy finds: you pick up from 1 cell further.',
      voice: { pitch: 1.3, rate: 1.0 },
      meet: 'Hello! Nova here, junior astronaut. My rover got lost on the Moon. Help me find it?',
      story: [
        'I trained for 3 years to be an astronaut. That is 1,095 days. I counted.',
        'My rover is called Sparky. It has 6 wheels and a little flag. I miss it.',
        'From the Moon, Earth looks like a blue marble. Your house is down there somewhere!',
        'Mission report: I found the best friend in the whole galaxy. Mission complete!'
      ],
      chat: ['On the Moon you weigh much less. Boing!', 'Iron is great for rocket parts.', 'Countdown to digging: 3, 2, 1, dig!', 'There is no wind on the Moon. Footprints stay forever!', 'I can see 10 stars. No, 11!'],
      gift: 'Iron! Perfect for fixing Sparky. Thank you, crew mate!',
      lines: { fossil: ['Fossil detected!', 'A space bone? Amazing!'], trap: ['Systems dizzy!'], full: ['Cargo bay full. Return to base!'], party: ['Mission success!'], up: ['Friendship level rising!'], hello: ['Nova reporting!', 'Ready for launch!'] } },
    { name: 'Blip', who: 'Alien from Planet Glorp', icon: '👾',
      about: 'Very polite and very curious. Blip thinks your hard hat is a crown and that coal is candy.',
      perk: 'Bone Nose', perkText: 'Blip sniffs out fossils: everyone breaks bone blocks twice as fast.',
      voice: { pitch: 1.9, rate: 1.25 },
      meet: 'Greetings, Earth royal! I am Blip. Your crown is very shiny. May I dig with you, please?',
      story: [
        'On Glorp we say hello by wiggling. Wiggle wiggle! Now you try!',
        'Earth has so many things. Dogs! Pizza! Socks! I love socks.',
        'The Star Seed is very old. It can grow a tree of stars. Only a good friend can plant it.',
        'On Glorp, a best friend gets a song. I made you one. Blip blip bloop! It means forever.'
      ],
      chat: ['Is coal candy? It looks like candy.', 'The goo is my cousin. Hello, cousin!', 'Thank you. Please. Thank you. Earth words are fun!', 'I have three hearts. They all like you.', 'Bloop! That means good morning.'],
      gift: 'Coal! My favourite candy! Crunch crunch. Thank you, Earth royal!',
      lines: { fossil: ['Blip blip! A bone!', 'Sniff sniff! Found it!'], trap: ['My antennas are spinning!'], full: ['The bag is full, please!'], party: ['Bloop bloop hooray!'], up: ['All three hearts are happy!'], hello: ['Wiggle wiggle!', 'Greetings!'] } }
  ];
  var HEART_NAMES = ['New friend', 'Pal', 'Good friend', 'Close friend', 'Best friend'];
  return { friends: friends, HEART_NAMES: HEART_NAMES };
})();
