import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

const app = Fastify()
const prisma = new PrismaClient();

app.get('/', async () => {
    const havits = await prisma.habit.findMany({
         where: {
            title: {
                startsWith: 'Ser'
            }
         }
    })

    return havits
})

app.listen({
    port: 3333
}).then(() => {
    console.log('Http server runing')
})