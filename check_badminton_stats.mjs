import prisma from './src/lib/prisma.js';

const userId = 'cmoeseths0000g4d8c9nicu6t';

const ms = await prisma.matchStats.findMany({
    where: { userId },
    take: 3,
    orderBy: { id: 'desc' },
    include: { badmintonStats: true }
});

console.log('\n=== MatchStats + BadmintonMatchStats ===');
for (const m of ms) {
    console.log('MatchStats:', {
        id: m.id, result: m.result, pointsScored: m.pointsScored, matchId: m.matchId
    });
    console.log('BadmintonStats:', m.badmintonStats);
    console.log('---');
}

await prisma.$disconnect();
