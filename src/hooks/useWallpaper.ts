const WALLPAPERS = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1920&q=80',
  'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=1920&q=80',
  'https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?w=1920&q=80',
  'https://images.unsplash.com/photo-1574873229781-93437ef86e60?w=1920&q=80',
  'https://images.unsplash.com/photo-1608501078713-8e445a709b39?w=1920&q=80',
  'https://images.unsplash.com/photo-1593642532842-98d0fd5ebc1a?w=1920&q=80',
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1920&q=80',
  'https://images.unsplash.com/photo-1548345680-f5475ea5df84?w=1920&q=80',
  'https://images.unsplash.com/photo-1528728329032-2972f65dfb3f?w=1920&q=80',
  'https://images.unsplash.com/photo-1516939884455-1445c8652f83?w=1920&q=80',
  'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=1920&q=80',
  'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=1920&q=80',
  'https://images.unsplash.com/photo-1568430462989-44163eb1752f?w=1920&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1920&q=80',
  'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=1920&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80',
  'https://images.unsplash.com/photo-1494059980473-813e73ee784b?w=1920&q=80',
  'https://images.unsplash.com/photo-1595433562696-fb06d98fede1?w=1920&q=80',
  'https://images.unsplash.com/photo-1518623489648-a173ef7824f3?w=1920&q=80',
  'https://images.unsplash.com/photo-1476041800959-2f6bb412c8ce?w=1920&q=80',
  'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80',
  'https://images.unsplash.com/photo-1502085671122-2d218cd434e6?w=1920&q=80',
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1920&q=80',
  'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1920&q=80',
  'https://images.unsplash.com/photo-1476158085676-e67f57ed9ed7?w=1920&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80',
  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1920&q=80',
  'https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=1920&q=80',
];

export const getDailyWallpaper = (): string => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return WALLPAPERS[dayOfYear % WALLPAPERS.length];
};
