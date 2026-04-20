import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up conversations...');
  
  // Deleting in order though Cascade should handle it
  const msgs = await prisma.message.deleteMany();
  console.log(`Deleted ${msgs.count} messages.`);
  
  const participants = await prisma.conversationParticipant.deleteMany();
  console.log(`Deleted ${participants.count} participants.`);
  
  const convs = await prisma.conversation.deleteMany();
  console.log(`Deleted ${convs.count} conversations.`);
  
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
