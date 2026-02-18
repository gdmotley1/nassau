import type { ReactionType } from '../stores/uiStore';

// ─── Message Templates ───────────────────────────────────────────
// {player} = person who just scored
// {opponent} = their opponent(s) — only used when opponent name is available

// Generic messages (no opponent reference)
const GENERIC: Record<ReactionType, string[]> = {
  eagle_or_better: [
    "That's going on the highlight reel.",
    'Absolute clinic.',
    'You just robbed the course.',
    'That one will be talked about at the 19th hole.',
    'Built different.',
    'Call the pro shop. They need to hear about this.',
    'Printing money out there.',
    'That was violent. In a good way.',
    'Tour-level stuff right there.',
    'The course just filed a complaint.',
    'That ball had GPS.',
    'Disgusting. Absolutely disgusting shot.',
    'Someone call the authorities.',
    'The handicap committee wants a word.',
    'Did that really just happen?',
    'Cash register noises.',
    'The golf gods are smiling.',
    "You don't see that every day.",
    'Screenshots or it didn\'t happen. Oh wait.',
    'That might be the shot of the year.',
    'The scorecard can\'t believe it either.',
    'Just violated that hole.',
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
    'The group behind is getting nervous.',
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
    'Cash that one.',
    'Scoreboard pressure building.',
    'Easy money.',
    'Making the hard look routine.',
    'Dialed in.',
    'Surgeon-like precision.',
    'Don\'t look now, but someone means business.',
    'The flagstick never stood a chance.',
    'Hole won\'t forget that one.',
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
    'Wallet is watching.',
    'Your opponent liked that.',
    'That one stings.',
    'Shake it off.',
    'Sloppy. You\'re better than that.',
    'The course owes you nothing.',
    'That\'s gonna cost you.',
    'The wheels are wobbling.',
    'Meh.',
    'Could\'ve been worse. Could\'ve been better.',
    'Your wallet just felt that.',
    'Not ideal, chief.',
    'Mental reset. Now.',
    'The driver betrayed you.',
    'That was... a choice.',
    'Bogey train arriving at the station.',
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
    'Back to level par. The hard way.',
    'Your caddie would\'ve talked you out of that.',
    'We\'re not gonna talk about that approach shot.',
  ],
  double_plus: [
    'That hole owes you money.',
    'Brutal. Just brutal.',
    'The wheels came off.',
    'Your playing partners are hiding their smiles.',
    'Somewhere, your wallet just flinched.',
    'We don\'t talk about that one.',
    'Rough day at the office.',
    'Maybe take a mulligan on life.',
    'That was hard to watch.',
    'The scorecard is blushing.',
    'Multiple things went wrong there.',
    'Your handicap just went up.',
    'Whoever said golf is relaxing never played this hole.',
    'The bar tab just got more expensive.',
    'Maybe try a different hobby.',
    'That was character building.',
    'Your opponents just high-fived. Mentally.',
    'Did you close your eyes on that swing?',
    'That hole should send you an apology.',
    'Even the cart girl felt that.',
    'The scorecard needs therapy.',
    'Triple threat. And not the good kind.',
    'Your playing partners have never been happier.',
    'That one is getting talked about in the parking lot.',
    'The only way out is through.',
    'Remember: it\'s just a game. A game you\'re losing.',
    'The range is calling your name.',
    'You\'ll laugh about this later. Not today.',
    'Somebody get the man a drink.',
    'That was a masterclass in what not to do.',
    'I\'m not mad, I\'m just disappointed.',
    'The hazard welcomed you with open arms.',
    'New hole, new you. Please.',
    'That was a lot of swings for not a lot of progress.',
    'The 19th hole is calling.',
    'At least the weather is nice.',
  ],
};

// Opponent-referencing messages (when we know who they're playing against)
// {opponent} will be replaced with the opponent's first name
const WITH_OPPONENT: Record<ReactionType, string[]> = {
  eagle_or_better: [
    '{opponent} just felt a chill down their spine.',
    '{opponent} is in trouble and doesn\'t even know it yet.',
    '{opponent}\'s wallet is sweating.',
    'Somebody tell {opponent} what just happened.',
    '{opponent} is going to need a bigger press.',
    '{opponent} just lost their appetite.',
    '{player} just sent {opponent} a message.',
    '{opponent} is punching air right now.',
    'That\'s the kind of shot that makes {opponent} order a double.',
    '{opponent}\'s caddie is updating the resume.',
    '{opponent} might want to sit down for this.',
    'The money is flowing away from {opponent}.',
    '{player} chose violence. {opponent} chose wrong.',
    '{opponent} is rethinking this whole bet.',
    'Somewhere {opponent} felt a disturbance in the force.',
    '{opponent} just aged 5 years.',
    '{player} out here making {opponent} look silly.',
    '{opponent} is going to hear about this at work.',
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
    '{opponent}\'s confidence took a hit.',
    'The gap is closing. {opponent} can feel it.',
    '{opponent} might need to press.',
    'If you\'re {opponent}, you\'re starting to sweat.',
    '{player} putting on a show for {opponent}.',
    '{opponent} is looking at the leaderboard nervously.',
    '{player} is not going away. Bad news for {opponent}.',
    '{opponent}\'s game plan did not include this.',
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
    '{opponent}\'s buying dinner with your money.',
    '{player} just gave {opponent} a gift.',
    '{opponent} didn\'t even have to do anything for that one.',
    '{opponent} is having a great time right now.',
    'The trash talk from {opponent} writes itself.',
    '{opponent}\'s wallet just got a little heavier.',
    '{player} making it easy for {opponent}.',
    '{opponent} will take that all day.',
    'You can hear {opponent} laughing from here.',
    'That one is going on {opponent}\'s highlight reel.',
    '{opponent} appreciates the donation.',
    '{player} handing strokes to {opponent} like candy.',
    'If {opponent} was nervous, they aren\'t anymore.',
    '{opponent} says thank you.',
  ],
  double_plus: [
    '{opponent} is trying very hard not to smile.',
    '{opponent} just made retirement plans with your money.',
    '{player} is paying for {opponent}\'s dinner. And drinks.',
    'That one hurt {player}\'s wallet and {opponent}\'s cheeks from smiling.',
    '{opponent} is having the time of their life.',
    '{opponent} didn\'t even need to play well for that one.',
    '{player} single-handedly funding {opponent}\'s weekend.',
    '{opponent} is composing the group chat message right now.',
    'That disaster just became {opponent}\'s favorite story.',
    '{opponent} hasn\'t been this happy since their last birdie.',
    '{player} playing like {opponent}\'s favorite charity.',
    '{opponent} needs a bigger wallet for all this cash.',
    'The bet was over before this hole. Now it\'s just sad.',
    '{opponent} is wondering if they should press. For fun.',
    '{player} basically wrote {opponent} a check on that hole.',
    '{opponent} is going to talk about this one for weeks.',
    'That was a gift wrapped hole for {opponent}.',
    '{opponent} barely had to lift a finger.',
    '{player} out here playing like {opponent}\'s personal ATM.',
    '{opponent} should really send a thank you card.',
  ],
};

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get a random reaction message, optionally personalized with names.
 * @param type - The reaction type (eagle, birdie, par, bogey, double+)
 * @param playerName - The name of the player who scored (optional)
 * @param opponentNames - Names of opponents (optional) — picks one at random
 */
export function getRandomMessage(
  type: ReactionType,
  playerName?: string,
  opponentNames?: string[],
): string {
  // Decide whether to use an opponent-referencing message
  const hasOpponent = opponentNames && opponentNames.length > 0 && playerName;
  const useOpponentMsg = hasOpponent && Math.random() < 0.6; // 60% chance if opponent available

  if (useOpponentMsg && hasOpponent) {
    const pool = WITH_OPPONENT[type];
    const template = pool[Math.floor(Math.random() * pool.length)];
    const opponent = opponentNames[Math.floor(Math.random() * opponentNames.length)];
    return template
      .replace(/\{opponent\}/g, opponent)
      .replace(/\{player\}/g, playerName!);
  }

  // Fall back to generic messages, optionally injecting player name
  const pool = GENERIC[type];
  const msg = pool[Math.floor(Math.random() * pool.length)];
  return msg;
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
