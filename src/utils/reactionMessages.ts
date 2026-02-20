import type { ReactionType, GameMode } from '../stores/uiStore';

// ─── Message Templates ───────────────────────────────────────────
// {player} = person who just scored
// {opponent} = their opponent(s) — only used when opponent name is available

// ─── GENERIC (no opponent reference, shared fallback) ────────────

const GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    "That's going on the highlight reel.",
    'Absolute clinic.',
    'You just robbed the course.',
    'That one will be talked about at the 19th hole.',
    'Built different.',
    'Call the pro shop. They need to hear about this.',
    'That was violent. In a good way.',
    'Tour-level stuff right there.',
    'The course just filed a complaint.',
    'That ball had GPS.',
    'Disgusting. Absolutely disgusting shot.',
    'Someone call the authorities.',
    'The handicap committee wants a word.',
    'Did that really just happen?',
    'The golf gods are smiling.',
    "You don't see that every day.",
    'Screenshots or it didn\'t happen. Oh wait.',
    'That might be the shot of the year.',
    'The scorecard can\'t believe it either.',
    'Somebody get the man a trophy.',
    'Cold. Blooded.',
    'Walking to the next tee with a different kind of swagger.',
  ],
  birdie: [
    'Under par. Dangerous.',
    'Stick it close, drain it.',
    'That putt had eyes.',
    'Making it look easy.',
    'Clean.',
    'One under. Keep the foot on the gas.',
    'Smooth operator.',
    'That ball was on a string.',
    'Professional vibes right there.',
    'Momentum is a hell of a drug.',
    'You\'re cooking right now.',
    'Red numbers on the card.',
    'The putter is hot today.',
    'Fairway, green, drain. Textbook.',
    'Came to play today.',
    'Someone woke up feeling dangerous.',
    'That swing was butter.',
    'No hesitation on that putt.',
    'Starting to heat up.',
    'The zone. You\'re in it.',
    'Dialed in.',
    'Surgeon-like precision.',
    'Don\'t look now, but someone means business.',
    'The flagstick never stood a chance.',
  ],
  par: [
    'Solid.',
    'Moving on.',
    'No damage done.',
    'Fairways and greens.',
    'Nothing wrong with that.',
    'Steady.',
    'Par is your friend today.',
    'That\'ll play.',
    'Keep the card clean.',
    'Sometimes boring is beautiful.',
    'On to the next.',
    'No drama. Nice.',
    'Smart golf.',
    'Calculated.',
    'The safe play pays off.',
    'Routine.',
    'Next.',
    'Clean card.',
    'Par saves are underrated.',
    'Held the line.',
  ],
  bogey: [
    'One over. Shake it off.',
    'Find the fairway next time.',
    'The course just hit back.',
    'Forget that one. Next hole.',
    'That one stings.',
    'Shake it off.',
    'Sloppy. You\'re better than that.',
    'The course owes you nothing.',
    'The wheels are wobbling.',
    'Meh.',
    'Could\'ve been worse. Could\'ve been better.',
    'Not ideal, chief.',
    'Mental reset. Now.',
    'The driver betrayed you.',
    'That was... a choice.',
    'Grip it and rip it didn\'t work.',
    'The rough is not your friend.',
    'Time to grind.',
    'That three-putt was personal.',
    'The short game took the day off.',
    'You can\'t buy those back.',
    'Stroke donated to the course.',
    'The golf gods giveth. And they taketh.',
    'Tough break. Or was it?',
    'Have you considered lessons?',
    'The beer cart can\'t get here fast enough.',
    'That hole bit back.',
    'Your caddie would\'ve talked you out of that.',
  ],
  double_plus: [
    'That hole owes you money.',
    'Brutal. Just brutal.',
    'The wheels came off.',
    'Your playing partners are hiding their smiles.',
    'We don\'t talk about that one.',
    'Rough day at the office.',
    'Maybe take a mulligan on life.',
    'That was hard to watch.',
    'The scorecard is blushing.',
    'Multiple things went wrong there.',
    'Your handicap just went up.',
    'Whoever said golf is relaxing never played this hole.',
    'Maybe try a different hobby.',
    'That was character building.',
    'Did you close your eyes on that swing?',
    'That hole should send you an apology.',
    'The scorecard needs therapy.',
    'Triple threat. And not the good kind.',
    'That one is getting talked about in the parking lot.',
    'The only way out is through.',
    'The range is calling your name.',
    'You\'ll laugh about this later. Not today.',
    'Somebody get the man a drink.',
    'That was a masterclass in what not to do.',
    'I\'m not mad, I\'m just disappointed.',
    'The hazard welcomed you with open arms.',
    'New hole, new you. Please.',
    'The 19th hole is calling.',
    'At least the weather is nice.',
  ],
};

// ─── OPPONENT-REFERENCING (shared fallback) ──────────────────────
// {opponent} will be replaced with the opponent's first name

const WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{opponent} just felt a chill down their spine.',
    '{opponent} is in trouble and doesn\'t even know it yet.',
    '{opponent}\'s wallet is sweating.',
    'Somebody tell {opponent} what just happened.',
    '{opponent} just lost their appetite.',
    '{player} just sent {opponent} a message.',
    '{opponent} is punching air right now.',
    'That\'s the kind of shot that makes {opponent} order a double.',
    '{opponent} might want to sit down for this.',
    '{player} chose violence. {opponent} chose wrong.',
    '{opponent} is rethinking this whole bet.',
    '{opponent} just aged 5 years.',
    '{player} out here making {opponent} look silly.',
    '{player} is {opponent}\'s worst nightmare right now.',
    'That shot just ruined {opponent}\'s whole afternoon.',
  ],
  birdie: [
    '{opponent} won\'t be happy about that one.',
    '{opponent}\'s lead just got a little smaller.',
    '{player} is coming for {opponent}\'s money.',
    '{opponent} should be worried.',
    'Bad news for {opponent}.',
    'Pressure on {opponent} now.',
    '{player} is heating up. {opponent}, you watching?',
    '{opponent} needs to respond.',
    'That one stings if you\'re {opponent}.',
    '{opponent}\'s grip just got a little tighter.',
    '{player} just made this interesting for {opponent}.',
    'The gap is closing. {opponent} can feel it.',
    'If you\'re {opponent}, you\'re starting to sweat.',
    '{player} putting on a show for {opponent}.',
    '{player} is not going away. Bad news for {opponent}.',
    'Birdie bomb. {opponent} heard the roar.',
  ],
  par: [
    '{opponent} was hoping for worse.',
    'Nothing for {opponent} to celebrate there.',
    '{opponent} stays where they are.',
    'Steady. {opponent} can\'t gain ground on that.',
    'No free money for {opponent} on that one.',
    'Hold the line against {opponent}.',
    '{opponent} was praying for a bogey.',
    'Not what {opponent} wanted to see.',
    '{player} keeps the pressure on {opponent}.',
    'Par. {opponent} gets nothing.',
  ],
  bogey: [
    '{opponent} just did a little fist pump.',
    '{opponent} is smiling and trying to hide it.',
    'That one put money in {opponent}\'s pocket.',
    '{opponent} sends their regards.',
    'Free hole for {opponent}. Thanks.',
    'Just what {opponent} ordered.',
    '{player} just gave {opponent} a gift.',
    '{opponent} didn\'t even have to do anything for that one.',
    '{opponent} is having a great time right now.',
    '{opponent}\'s wallet just got a little heavier.',
    '{player} making it easy for {opponent}.',
    '{opponent} will take that all day.',
    '{opponent} appreciates the donation.',
    'If {opponent} was nervous, they aren\'t anymore.',
    '{opponent} says thank you.',
  ],
  double_plus: [
    '{opponent} is trying very hard not to smile.',
    '{player} is paying for {opponent}\'s dinner. And drinks.',
    '{opponent} is having the time of their life.',
    '{opponent} didn\'t even need to play well for that one.',
    '{player} single-handedly funding {opponent}\'s weekend.',
    '{opponent} is composing the group chat message right now.',
    'That disaster just became {opponent}\'s favorite story.',
    '{player} playing like {opponent}\'s favorite charity.',
    '{opponent} is going to talk about this one for weeks.',
    'That was a gift wrapped hole for {opponent}.',
    '{opponent} barely had to lift a finger.',
    '{player} out here playing like {opponent}\'s personal ATM.',
    '{opponent} should really send a thank you card.',
  ],
};

// ─── NASSAU-SPECIFIC ─────────────────────────────────────────────
// Themed around front/back/overall bets, presses, and head-to-head money

const NASSAU_GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    'Printing money out there.',
    'Cash register noises.',
    'Just violated that hole.',
    'That\'s front, back, AND overall damage.',
    'All three bets just shifted.',
    'That shot changed the entire match.',
    'Time to press? Too late now.',
    'The Nassau just got expensive.',
    'Three bets. Three problems for everyone else.',
    'That\'s the kind of shot that ends presses early.',
    'The overall bet just got interesting.',
    'Walking to the next tee counting money.',
    'The back nine just got a whole lot cheaper.',
  ],
  birdie: [
    'Scoreboard pressure building.',
    'Easy money.',
    'Cash that one.',
    'The group behind is getting nervous.',
    'That\'s a swing on the front nine.',
    'Back nine just flipped.',
    'Press-worthy performance right there.',
    'That birdie echoes across all three bets.',
    'Keep stacking birdies, keep stacking cash.',
    'The overall lead just padded.',
    'That putt was worth more than just one stroke.',
    'Front nine money secured.',
    'That\'s a press-killer.',
    'Playing with house money now.',
    'Building a lead one birdie at a time.',
  ],
  par: [
    'No damage to the bankroll.',
    'Holding serve on all three.',
    'The bets stay where they are.',
    'A par is a par is a par. Steady cash.',
    'Nothing gained, nothing lost.',
    'The press can wait. Par holds.',
    'Protect the lead. Smart par.',
    'Par saves the bankroll.',
    'One less hole to worry about.',
    'All square stays all square. Fine.',
  ],
  bogey: [
    'Wallet is watching.',
    'Your opponent liked that.',
    'That\'s gonna cost you.',
    'Your wallet just felt that.',
    'Bogey train arriving at the station.',
    'That one just flipped the front nine.',
    'Time to start thinking about a press.',
    'The overall bet is slipping.',
    'Gave one back. And some dollars.',
    'Your opponent is doing the math already.',
    'That bogey hit all three bets.',
    'Back nine lead getting thinner.',
    'The press is looking more tempting now.',
    'Front nine money walking out the door.',
  ],
  double_plus: [
    'Somewhere, your wallet just flinched.',
    'The bar tab just got more expensive.',
    'Your opponents just high-fived. Mentally.',
    'Even the cart girl felt that.',
    'Your playing partners have never been happier.',
    'Remember: it\'s just a game. A game you\'re losing.',
    'That just flipped the front, back, and overall.',
    'Triple damage. All three bets bleeding.',
    'Your press just pressed itself.',
    'The overall bet? Gone. Finished. Done.',
    'That hole was worth more than you wanted to spend.',
    'Two holes like that and you\'re buying dinner.',
    'The 19th hole is calling. You\'re buying.',
    'That disaster echoed across all three bets.',
  ],
};

const NASSAU_WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{opponent}\'s wallet is sweating.',
    '{opponent} is going to need a bigger press.',
    'The money is flowing away from {opponent}.',
    '{opponent} just watched all three bets move the wrong way.',
    'That eagle just erased {opponent}\'s front nine lead.',
    '{player} just took control of the Nassau from {opponent}.',
    '{opponent} might want to press now. If they dare.',
    '{opponent}\'s overall bet is in critical condition.',
  ],
  birdie: [
    '{player} is coming for {opponent}\'s money.',
    '{opponent} might need to press.',
    '{opponent}\'s game plan did not include this.',
    '{opponent}\'s front nine lead just shrunk.',
    'That birdie just shifted the overall against {opponent}.',
    '{player} is stacking bets against {opponent}.',
    '{opponent} is recalculating the damage.',
    '{opponent} might want to rethink that press.',
    'Bad nine to be {opponent}.',
  ],
  par: [
    '{opponent} was hoping for worse.',
    'No free money for {opponent} on that one.',
    '{opponent} can\'t gain ground when {player} pars.',
    'Par. The bets stay put. {opponent} gets nothing.',
    '{opponent} needs {player} to slip. Not today.',
  ],
  bogey: [
    '{opponent}\'s buying dinner with your money.',
    '{player} handing strokes to {opponent} like candy.',
    'That bogey just handed {opponent} the front nine.',
    '{opponent} is doing the Nassau math with a smile.',
    '{player} gift-wrapping the overall for {opponent}.',
    'Free hole for {opponent}. The bets agree.',
    '{opponent} didn\'t even have to play well. Thanks, {player}.',
  ],
  double_plus: [
    '{opponent} just made retirement plans with your money.',
    'That one hurt {player}\'s wallet and {opponent}\'s cheeks from smiling.',
    '{player} basically wrote {opponent} a check on that hole.',
    '{opponent} is wondering if they should press. For fun.',
    '{opponent} just won all three bets on one hole. Thanks.',
    '{player} single-handedly funding {opponent}\'s weekend via Nassau.',
    '{opponent} is composing the group chat message right now.',
  ],
};

// ─── SKINS-SPECIFIC ──────────────────────────────────────────────
// Themed around winning/losing individual hole skins and carryovers

const SKINS_GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    'That skin is claimed. Violently.',
    'Nobody is tying that. Skin locked.',
    'Eagle on a carryover hole? Devastating.',
    'Skin collected. No questions asked.',
    'That\'s a fat skin. Take it to the bank.',
    'The pot just got a lot lighter.',
    'Nobody\'s matching that. Cash it.',
    'Skin stolen in broad daylight.',
    'That shot just ended the carryover streak.',
    'One swing. One skin. One paycheck.',
    'The carryover was building. Now it\'s gone.',
    'That eagle didn\'t just win the hole. It won the pot.',
    'The skin game just found its winner.',
  ],
  birdie: [
    'Birdie takes the skin. Unless...',
    'That should hold up for the skin.',
    'Red number. That skin is yours to lose.',
    'Birdie in a skins game hits different.',
    'Skin leader in the clubhouse.',
    'That birdie is worth more than just one stroke.',
    'Tough skin to beat. Birdie ball.',
    'The pressure is on everyone else to match.',
    'Birdie and a skin. Name a better combo.',
    'That putt was worth its weight in skins.',
    'Carryover or not, that birdie is scary.',
    'Looking like a skin. Unless someone gets aggressive.',
    'Birdie earns the right to watch everyone else try.',
  ],
  par: [
    'Par in a skins game. Could go either way.',
    'That might hold. Might not.',
    'Par. Waiting to see if it survives.',
    'The skin is still up for grabs.',
    'Par keeps you in it. Barely.',
    'Safe play. But skins reward the bold.',
    'Standing pat with par. Let\'s see.',
    'Par won\'t win many skins. But it won\'t lose them either.',
    'Holding steady. The skin hangs in the balance.',
    'Par and a prayer that nobody birdies.',
  ],
  bogey: [
    'Bogey in a skins game. Irrelevant.',
    'That skin is gone. Move on.',
    'Can\'t win skins making bogeys.',
    'Donated that skin to the group.',
    'Bogey. The skin belongs to someone else.',
    'No skin for you. Better luck next hole.',
    'The carryover keeps building. Thanks to that bogey.',
    'Everyone else just got a little happier.',
    'That bogey might cause a carryover. Ouch.',
    'Skins are for birdies. That was a bogey.',
    'Skin? What skin? That bogey says no.',
    'Building the pot for someone else.',
  ],
  double_plus: [
    'That didn\'t just lose the skin. It\'s embarrassing.',
    'The skin is gone. Your pride might be too.',
    'Contributing to the carryover. Generously.',
    'That hole was a skin donation center.',
    'Even in skins, that\'s hard to watch.',
    'The carryover grows. Your dignity shrinks.',
    'Nobody wins a skin with that number.',
    'That was the opposite of winning a skin.',
    'Adding to the pot the hard way.',
    'The group thanks you for fattening the carryover.',
    'That score is a carryover\'s best friend.',
  ],
};

const SKINS_WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{player} just snatched that skin from {opponent}.',
    '{opponent} had no answer for that. Skin claimed.',
    'That carryover pot? {player} just took it from {opponent}\'s grasp.',
    '{opponent} needed that skin. {player} stole it.',
    '{player} just ended {opponent}\'s carryover dreams.',
    'Better luck next hole, {opponent}. That skin is {player}\'s.',
    '{opponent} is watching their skins total fall behind.',
  ],
  birdie: [
    '{opponent} needs to match or lose the skin.',
    '{player} just put the pressure on {opponent} for this skin.',
    'Can {opponent} match that? Doubtful.',
    '{player} is stacking skins. {opponent} is watching.',
    'That skin is heading {player}\'s way unless {opponent} responds.',
    '{opponent}\'s skin count isn\'t looking great right now.',
    '{player} birdie. {opponent} needs a miracle to tie.',
  ],
  par: [
    '{opponent} could still tie this skin.',
    'Par. {opponent} lives to fight for this skin.',
    '{player} is holding. {opponent} needs to beat it or push.',
    'Not enough to scare {opponent} off this skin.',
    'The skin is still alive between {player} and {opponent}.',
  ],
  bogey: [
    '{opponent} is one step closer to that skin.',
    '{player} just handed the skin to {opponent}.',
    'That bogey gift-wrapped the skin for {opponent}.',
    '{opponent} doesn\'t even need to be good. Just better than that.',
    '{player} out of the skin. {opponent} smells blood.',
    '{opponent} takes the skin by default. Thanks, {player}.',
  ],
  double_plus: [
    '{opponent} is collecting skins without breaking a sweat.',
    '{player} is basically {opponent}\'s personal skin donor.',
    'That disaster means more carryover skins for {opponent} later.',
    '{opponent} doesn\'t need birdies when {player} is posting those numbers.',
    '{player} building {opponent}\'s skin total one blowup at a time.',
    'The skins pot grows fatter. {opponent} licking their chops.',
  ],
};

// ─── MATCH PLAY-SPECIFIC ────────────────────────────────────────
// Themed around winning/losing individual holes, match status, dormie

const MATCH_PLAY_GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    'Hole won. Emphatically.',
    'That\'s a hole won and a statement made.',
    'Eagle wins the hole. The match just shifted.',
    'Momentum change. Big time.',
    'That hole wasn\'t close. Dominant.',
    'One hole closer to closing it out.',
    'The match just swung on that shot.',
    'That\'s the kind of hole that changes matches.',
    'Winning holes like that? Match play royalty.',
    'Statement hole. The match just got real.',
    'That\'s how you flip a match on its head.',
    'Hole won. The scoreboard likes that.',
    'The match was even. Not anymore.',
  ],
  birdie: [
    'Birdie wins the hole. Match play at its finest.',
    'That should win the hole.',
    'Hard to lose a hole with a birdie.',
    'Hole won. Birdie does the trick.',
    'One up. Or further up. Either way, birdie.',
    'Match play rewards the bold. Birdie ball.',
    'That birdie just won a hole. Simple math.',
    'Winning the hole the right way.',
    'Birdie and a blue square on the board.',
    'One step closer to closing out the match.',
    'Good luck halving that one.',
    'Birdie is the language of match play.',
    'That hole has a new owner.',
    'Keep winning holes. Keep winning the match.',
  ],
  par: [
    'Halved. On to the next.',
    'Par might halve this hole.',
    'Match play par. Could win, could halve.',
    'No movement on the board. Status quo.',
    'The match stays where it is.',
    'Halved hole. Reset.',
    'Par holds the line.',
    'Neither player blinks. Halve.',
    'Steady hole. The match rolls on.',
    'The match doesn\'t move. Both players live.',
  ],
  bogey: [
    'That probably lost the hole.',
    'Hole conceded in spirit.',
    'Hard to win holes making bogeys.',
    'That\'s a red square on the board.',
    'One down. Or further down.',
    'Losing holes like that loses matches.',
    'The match slipped a little further away.',
    'Bogey loses the hole. Back to the drawing board.',
    'Match play is unforgiving. Bogey proves it.',
    'That bogey just gave back a hole.',
    'The other side of the board just lit up.',
    'Holes are hard to win back. That one\'s gone.',
    'Dormie distance just got a little closer.',
  ],
  double_plus: [
    'That hole is long gone. Focus on the next.',
    'Hole lost. Badly.',
    'In match play, you only lose one hole at a time. Silver lining.',
    'At least it only counts as one hole lost.',
    'The match play mercy rule: it\'s still just one hole.',
    'Match play forgives the score. Not the hole.',
    'Lost the hole. But at least it wasn\'t stroke play.',
    'One hole down. The match isn\'t over yet.',
    'That was ugly. But match play doesn\'t care about ugly.',
    'The good news: you can\'t lose a hole twice.',
    'Reset. Match play gives you a fresh hole.',
    'Double, triple, doesn\'t matter. One hole. Move on.',
  ],
};

const MATCH_PLAY_WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{player} just took that hole from {opponent}. Decisively.',
    '{opponent} just lost a hole they didn\'t think they could lose.',
    'The match just swung against {opponent}. Hard.',
    '{player} wins the hole. {opponent} is running out of holes.',
    '{opponent} needs to respond. Now.',
    'That eagle moved the board against {opponent}.',
    '{player} is closing in. {opponent} feels the heat.',
    '{opponent}\'s match is slipping away.',
  ],
  birdie: [
    '{player} wins the hole. Pressure on {opponent}.',
    '{opponent} needs a birdie just to halve. Good luck.',
    '{player} goes 1 up on {opponent}. Or extends the lead.',
    '{opponent}\'s path to victory just got narrower.',
    'That birdie wins the hole from {opponent}.',
    '{player} is in control of the match against {opponent}.',
    '{opponent} is losing holes. {player} is collecting them.',
    'The board moves. {opponent} doesn\'t like the direction.',
  ],
  par: [
    'Halved with {opponent}. No movement.',
    '{opponent} survives. The match holds.',
    '{player} and {opponent} tie the hole. On to the next.',
    'The match stays put. {opponent} breathes.',
    'Neither {player} nor {opponent} blinks.',
  ],
  bogey: [
    '{opponent} wins the hole. Thanks to that bogey.',
    '{player} just gave {opponent} a free hole.',
    '{opponent} goes further up without doing anything special.',
    'Bogey hands the hole to {opponent}. Match play is cruel.',
    '{opponent} takes the hole. {player} needs to respond.',
    '{opponent} is collecting holes. {player} is giving them away.',
  ],
  double_plus: [
    '{opponent} wins the hole. Not that they needed to play well.',
    '{player} lost that hole so badly {opponent} almost felt bad. Almost.',
    '{opponent} just got a free hole from {player}.',
    'One less hole for {player} to mount a comeback against {opponent}.',
    '{opponent} says thanks for the hole. Moving on.',
    'Match play lesson: {opponent} only needed par. {player} needed a miracle.',
  ],
};

// ─── WOLF-SPECIFIC ──────────────────────────────────────────────
// Themed around wolf choices, solo/partner strategy, pack mentality, points

const WOLF_GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    'Wolf or not, that shot earns maximum points.',
    'The pack didn\'t see that coming.',
    'Points. Lots of points.',
    'If that\'s the wolf, solo was the right call.',
    'Eagle in a wolf game. Pure dominance.',
    'The wolf just ate. Feasted, actually.',
    'That shot just shifted the point totals.',
    'Whoever is on that team is celebrating.',
    'The wolf howls. The pack trembles.',
    'Point totals just exploded.',
    'If that\'s a solo wolf, the payout is massive.',
    'The pack has a problem.',
    'That eagle is worth double if you went alone.',
  ],
  birdie: [
    'Birdie for the team. Points incoming.',
    'The wolf\'s partner is celebrating.',
    'Birdie earns its weight in wolf points.',
    'Good pick if that\'s your partner.',
    'That birdie just earned the team some points.',
    'The pack needs to match or pay.',
    'Wolf game birdie. Partner smiling.',
    'Points on the board. Birdie ball.',
    'Best ball birdie. That\'s the wolf\'s bread and butter.',
    'Partner chemistry. Birdie proves it.',
    'The wolf made the right choice. Birdie confirms it.',
    'Birdie for the cause. Points for the team.',
  ],
  par: [
    'Par in wolf. Could go either way.',
    'Best ball par. Average but functional.',
    'The wolf needs more than par from the team.',
    'Par keeps you alive. Barely.',
    'No points gained on par. Unless the other side bogeys.',
    'Wolf waits. Par is not enough to celebrate.',
    'Holding steady. The wolf is patient.',
    'Par for the wolf\'s team. Serviceable.',
    'Points stay flat. Par is par.',
    'The pack matches par easily. Push.',
  ],
  bogey: [
    'The wolf\'s partner is not pulling their weight.',
    'Bogey for the team. That costs points.',
    'Bad pick. The wolf chose poorly.',
    'The pack smells weakness. Bogey.',
    'Points flowing the wrong direction.',
    'Bogey. The wolf howled at the wrong moon.',
    'If you went solo, that bogey doubles the damage.',
    'The partner is dragging the wolf down.',
    'The pack is gaining. Bogey helps their cause.',
    'Wolf points bleeding. Bogey by bogey.',
    'Solo wolf with a bogey. Math gets ugly.',
    'The pack thanks you for the bogey.',
  ],
  double_plus: [
    'The wolf chose... poorly.',
    'Solo wolf disaster. Double the pain.',
    'The pack feasts on that disaster.',
    'Points hemorrhaging. That was awful.',
    'If you went alone, you\'re paying triple.',
    'The wolf is now a puppy.',
    'Point total in freefall after that hole.',
    'The partner didn\'t carry their weight. At all.',
    'Whoever picked that partner owes everyone an apology.',
    'Blind wolf? More like blind to reality.',
    'The pack didn\'t even need to play well. Just wait.',
    'Wolf game blowup. The points tell the story.',
  ],
};

const WOLF_WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{player} just crushed {opponent}\'s wolf team.',
    'The pack wins that hole. {opponent}\'s wolf choice backfired.',
    '{player} just took major points from {opponent}.',
    '{opponent}\'s solo wolf just ran into an eagle. Expensive.',
    '{player} earning double points off {opponent}\'s team.',
    '{opponent} picked the wrong hole to be wolf.',
    'The pack is eating. {opponent} is the meal.',
    '{opponent}\'s point total is taking a beating.',
  ],
  birdie: [
    '{player}\'s birdie just cost {opponent} points.',
    '{opponent}\'s wolf strategy didn\'t account for that birdie.',
    'Points swing from {opponent} to {player}. Birdie.',
    '{player}\'s team best ball birdie. {opponent}\'s problem.',
    '{opponent} needs to answer or bleed points.',
    'The wolf picked {opponent}? Should\'ve picked {player}.',
    '{player} earning points at {opponent}\'s expense.',
  ],
  par: [
    '{opponent}\'s team pars too. Push.',
    'Par for par. No points exchanged between {player} and {opponent}.',
    '{player} and {opponent} cancel each other out.',
    'No damage to {opponent}. Yet.',
    'The wolf watches. {player} and {opponent} halve.',
  ],
  bogey: [
    '{opponent} picks up points off {player}\'s bogey.',
    '{player} just padded {opponent}\'s point total.',
    'Free points for {opponent}. Thanks, {player}.',
    '{opponent}\'s wolf team wins the hole off {player}\'s bogey.',
    '{player}\'s bogey is {opponent}\'s gain. Wolf math.',
    '{opponent} didn\'t even have to play well. {player} did the work.',
  ],
  double_plus: [
    '{opponent} is stacking points thanks to {player}.',
    '{player} out here as {opponent}\'s personal point factory.',
    '{opponent}\'s wolf game just got funded by {player}.',
    'That disaster is worth maximum points for {opponent}.',
    '{player} contributing generously to {opponent}\'s wolf total.',
    '{opponent} is running away with points. {player} can\'t stop the bleeding.',
  ],
};

// ─── MESSAGE POOL MAPPING ───────────────────────────────────────

type MessagePool = Record<ReactionType, string[]>;

const GAME_MODE_GENERIC: Record<GameMode, MessagePool> = {
  nassau: NASSAU_GENERIC,
  skins: SKINS_GENERIC,
  match_play: MATCH_PLAY_GENERIC,
  wolf: WOLF_GENERIC,
};

const GAME_MODE_WITH_OPPONENT: Record<GameMode, MessagePool> = {
  nassau: NASSAU_WITH_OPPONENT,
  skins: SKINS_WITH_OPPONENT,
  match_play: MATCH_PLAY_WITH_OPPONENT,
  wolf: WOLF_WITH_OPPONENT,
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get a random reaction message, optionally personalized with names.
 * Blends game-mode-specific messages with universal messages for variety.
 *
 * @param type - The reaction type (eagle, birdie, par, bogey, double+)
 * @param playerName - The name of the player who scored (optional)
 * @param opponentNames - Names of opponents (optional) — picks one at random
 * @param gameMode - The game type for mode-specific messages (optional, defaults to nassau)
 */
export function getRandomMessage(
  type: ReactionType,
  playerName?: string,
  opponentNames?: string[],
  gameMode: GameMode = 'nassau',
): string {
  const hasOpponent = opponentNames && opponentNames.length > 0 && playerName;

  // 60% chance to use opponent-referencing message if opponent available
  const useOpponentMsg = hasOpponent && Math.random() < 0.6;

  if (useOpponentMsg && hasOpponent) {
    // Blend: 65% game-mode-specific, 35% universal fallback
    const modePool = GAME_MODE_WITH_OPPONENT[gameMode][type];
    const universalPool = WITH_OPPONENT[type];
    const useModeSpecific = Math.random() < 0.65 && modePool.length > 0;
    const pool = useModeSpecific ? modePool : universalPool;
    const template = pool[Math.floor(Math.random() * pool.length)];
    const opponent = opponentNames[Math.floor(Math.random() * opponentNames.length)];
    return template
      .replace(/\{opponent\}/g, opponent)
      .replace(/\{player\}/g, playerName!);
  }

  // Generic (no opponent): 65% game-mode-specific, 35% universal
  const modePool = GAME_MODE_GENERIC[gameMode][type];
  const universalPool = GENERIC[type];
  const useModeSpecific = Math.random() < 0.65 && modePool.length > 0;
  const pool = useModeSpecific ? modePool : universalPool;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getReactionLabel(score: number, par: number): string {
  if (score === 1) return 'ACE';

  const diff = score - par;
  if (diff <= -3) return 'ALBATROSS';
  if (diff === -2) return 'EAGLE';
  if (diff === -1) return 'BIRDIE';
  if (diff === 0) return 'PAR';
  if (diff === 1) return 'BOGEY';
  if (diff === 2) return 'DOUBLE BOGEY';
  if (diff === 3) return 'TRIPLE BOGEY';
  if (score >= 8) return 'SNOWMAN';
  return `+${diff}`;
}

export function getReactionType(score: number, par: number): ReactionType {
  const diff = score - par;
  if (diff <= -2 || score === 1) return 'eagle_or_better';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double_plus';
}
