import prisma from './src/lib/prisma.js';

const userId = 'cmoeseths0000g4d8c9nicu6t';

const matchStats = await prisma.matchStats.findMany({
    where: { userId },
    select: { id: true, result: true, sportCode: true, gameType: true, pointsScored: true, pointsConceded: true, matchId: true }
});
console.log('\n=== MatchStats records ===');
console.log('Count:', matchStats.length);
console.log(JSON.stringify(matchStats, null, 2));

const matches = await prisma.match.findMany({
    where: { participants: { some: { userId } } },
    select: { id: true, status: true, sportCode: true, gameType: true, completedAt: true, startedAt: true }
});
console.log('\n=== Matches for user ===');
console.log('Count:', matches.length);
console.log(JSON.stringify(matches, null, 2));

const sportProfile = await prisma.sportProfile.findMany({
    where: { userId },
    select: { sportCode: true, matchesPlayed: true, wins: true, losses: true }
});
console.log('\n=== SportProfile ===');
console.log(JSON.stringify(sportProfile, null, 2));

await prisma.$disconnect();
