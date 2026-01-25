// Script temporário para listar usuários
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    console.log('\n📋 Usuários disponíveis no banco:\n');
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no banco!');
      console.log('\n💡 Faça login via Google primeiro para criar um usuário.');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.displayName} (${user.email})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   🔗 Bypass URL: http://localhost:4000/api/auth/bypass?userId=${user.id}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();

