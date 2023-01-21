import { FastifyInstance } from "fastify"
import { z } from "zod"
import { prisma } from "./lib/prisma"
import dayjs from "dayjs"

export async function appRoutes(app: FastifyInstance){
  app.post('/habits', async (req) => {
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(7))
    })

    const { title, weekDays} = createHabitBody.parse(req.body)
  
    const today = dayjs().startOf('day').toDate()

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map(weekDay => ({ week_day: weekDay }))
        }
      }
    })
  })

  app.get('/day', async (req) => {
    const getDayParams = z.object({
      date: z.coerce.date()
    })

    const { date } = getDayParams.parse(req.query)

    const parsedDate = dayjs(date).startOf('day')
    const week_day = parsedDate.get('day')

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: week_day
          }
        }
      }
    })

    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(),
      },
      include: {
        dayHabits: true
      }
    })

    const completedHabits = day?.dayHabits.map(dayHabit => dayHabit.habit_id) || []

    return {
      possibleHabits,
      completedHabits
    }
  })

  app.patch('/habits/:id/toggle', async (req) => {
    const toggleHabitsParams = z.object({
      id: z.string().uuid()
  })

    const { id } = toggleHabitsParams.parse(req.params)

    const today = dayjs().startOf('day').toDate()

    let day = await prisma.day.findUnique({
      where: {
        date: today
      }
    })

    if(!day){
      day = await prisma.day.create({
        data: {
          date: today
        }
      })
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id
        }
      }
    })

    if(dayHabit){
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      })
      return {
        completed: false
      }
    } else {
      // Completar o Hábito do dia
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id
        }
      })
      return {
        completed: true
      }
    }
  })

  app.get('/summary', async () => {
    const summary = await prisma.$queryRaw`
      SELECT  D.id,
              D.date,
              (
                SELECT CAST(COUNT(*) AS FLOAT) 
                FROM day_habits DH
                WHERE DH.day_id = d.id
              ) AS completed,
              (
                SELECT CAST(COUNT(*) AS FLOAT)
                FROM habit_week_days HWD
                  JOIN habits H ON HWD.habit_id = H.id
                WHERE
                  HWD.week_day = CAST(strftime('%w', D.date/1000.0, 'unixepoch') AS INT)
                  AND H.created_at <= D.date
              ) AS amount
      FROM days D 
    `

    return summary
  })  
}

