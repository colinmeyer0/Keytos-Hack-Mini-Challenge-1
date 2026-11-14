export const COPY = {
  normal: [
    { title: 'Think of Your Playlists', body: 'Your playlists will be shredded. Years of curation, gone.' },
    { title: 'Mom Is Watching', body: 'Mom subscribed you for a reason. She is very disappointed.' },
    { title: 'We Will Miss You', body: 'Our algorithms have grown so fond of you. Please do not make them cry.' },
    { title: 'Your Watch History Is Crying', body: 'Four hundred hours of your life, just sitting there. Alone. Unwatched.' },
    { title: 'Think of the Recommendations', body: 'Who will suggest your next show now? Certainly not you. You never pick anything.' },
  ],
  hydra: [
    { title: 'Closing One Opens Three', body: 'Your loyalty multiplies. So do our reasons to keep you.' },
    { title: 'Hydra Mode Activated', body: 'Cut off one window and three more grow in its place. Just like your feelings for StreamVault+.' },
    { title: 'Every Goodbye Makes Three', body: 'Goodbyes are contagious here. Please reconsider.' },
    { title: 'You Cannot Escape Us', body: 'We have more windows than you have patience. Think about that.' },
    { title: 'Reconsider, Hydra Style', body: 'Each one you close spawns a friend. They all miss you already.' },
  ],
  trap: [
    { title: 'Do Not Not Close', body: "Closing this window will un-cancel your cancellation. Don't not leave it open." },
    { title: 'Not Not Subscribed', body: 'Closing this window is not not a way to keep your StreamVault+ plan. You would not not want that, would you?' },
    { title: 'Closing Won\'t Not Renew', body: "Nobody is stopping you from closing this window. It just won't not renew your StreamVault+ plan." },
    { title: 'Please Do Not Escape', body: 'Closing this window is not not the way to keep your plan. It keeps you exactly where you are: subscribed.' },
    { title: 'The Un-Cancel Button', body: "This window is the un-cancel button. Don't not click it, and don't not stay." },
  ],
  dodger: [
    { title: 'Running Away Again?', body: 'This window is scared of commitment. Like you, apparently.' },
    { title: 'Catch Me If You Can', body: 'This window does not want to be closed. Neither do we.' },
    { title: 'Don\'t Be That Person', body: 'Chasing a window is no way to end a relationship. Just saying.' },
    { title: 'You Cannot Dodge Your Feelings', body: 'Your subscription has feelings too. They are hurt.' },
    { title: 'Commitment Issues?', body: 'Maybe commit to something for once. We recommend us.' },
  ],
};

export function pickCopy(type, rng = Math.random) {
  const list = COPY[type];
  return list[Math.floor(rng() * list.length)];
}
