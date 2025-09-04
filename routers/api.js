const Router = require('express')
const router = new Router()
const { startSession, Types } = require('mongoose')
const {
  User,
  Group,
  Discipline,
  Connection,
  Hours,
  Lesson,
  Score,
  Pricing,
  Pay,
  Finance,
  Quarter,
  KPI,
  Transfer
} = require('../models')
const errorLogger = require('../utils/errorLogger')
const authMiddleware = require('../utils/authMiddleware')
const getFirstLastDay = require('../utils/getFirstLastDay')
const generatePassword = require('../utils/generatePassword')

router.post('/get', authMiddleware(), async (req, res) => {
  try {
    return res.status(200).json(req.user)
  } catch (e) {
    errorLogger(req, res, e, '/get_groups')
  }
})
router.post('/get_groups', authMiddleware(['admin']), async (req, res) => {
  try {
    if (req.body?.showStudents) {
      const groups = await Group.find({ branch: req.user?.branch }).populate({ path: 'students' })
      return res.status(200).json(groups)
    }
    const groups = await Group.find({ branch: req.user?.branch })
    return res.status(200).json(groups)
  } catch (e) {
    errorLogger(req, res, e, '/get_groups')
  }
})
router.post('/get_group', authMiddleware(['admin']), async (req, res) => {
  const { groupId, quarterId, connectionId } = req.body
  try {
    const quarter = await Quarter.findById(quarterId)
    const lessons = await Lesson.find({ connection: connectionId, active: true })

    const group = await Group.findById(groupId)

    const transfers = await Transfer.find({$or: [{toGroup: groupId}, {fromGroup: groupId}]}).populate({path: 'toGroup fromGroup'}).sort({date: 1})
    const students = await User.aggregate([
      { $match: { _id: { $in: group.students } } },
      {
        $lookup: {
          from: 'scores',
          foreignField: 'student',
          localField: '_id',
          pipeline: [{ $match: { lesson: { $in: lessons.map((el) => el._id) } } }],
          as: 'scores'
        }
      },
      {
        $unwind: {
          path: '$scores',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'lessons',
          foreignField: '_id',
          localField: 'scores.lesson',
          as: 'lesson'
        }
      },
      {
        $unwind: {
          path: '$lesson',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          'lesson.date': {
            $cond: {
              if: {
                $and: [{ $gte: ['$lesson.date', quarter.startDate] }, { $lte: ['$lesson.date', quarter.endDate] }]
              },
              then: '$lesson.date',
              else: null
            }
          },
          scores: {
            $cond: {
              if: {
                $and: [{ $gte: ['$lesson.date', quarter.startDate] }, { $lte: ['$lesson.date', quarter.endDate] }]
              },
              then: '$scores',
              else: null
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { 'lesson.date': { $gte: quarter.startDate, $lte: quarter.endDate } },
            { 'lesson.date': { $exists: false } },
            { 'lesson.date': null }
          ]
        }
      },
      {
        $group: {
          _id: '$_id',
          familyName: { $first: '$familyName' },
          givenName: { $first: '$givenName' },
          imageUrl: { $first: '$imageUrl' },
          username: { $first: '$username' },
          active: { $first: '$active' },
          password: { $first: '$password' },
          lastLogin: {$first: '$lastLogin'},
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' },
          score: { $avg: '$scores.score' },
          behavior: { $avg: '$scores.behavior' },
          weeklyExam: { $avg: '$scores.weeklyExam' },
          homework: { $avg: '$scores.homework' },
          count: { $count: {} },
          attend: {
            $avg: {
              $cond: [{ $eq: ['$scores.attend', true] }, 100, { $cond: [{ $eq: ['$scores.attend', false] }, 0, null] }]
            }
          }
        }
      },
      { $sort: { givenName: 1 } }
    ])
    return res.status(200).json({...group._doc, students, transfers})
  } catch (e) {
    errorLogger(req, res, e, '/get_group')
  }
})
router.post('/get_teachers', authMiddleware(['admin']), async (req, res) => {
  try {
    const { selectedMonth } = req.body
    if (!selectedMonth) {
      const teachers = await User.find({ type: 'teacher', branch: req.user?.branch }).select('-password').sort({ givenName: 1 })
      return res.status(200).json(teachers)
    }
    const { firstMonday, lastSunday } = getFirstLastDay(selectedMonth)
    const teachers = await Score.aggregate([
      { $lookup: { from: 'lessons', foreignField: '_id', localField: 'lesson', as: 'lesson' } },
      { $unwind: '$lesson' },
      {$match: {'lesson.type': 'monthly_exam'}},
      { $match: { 'lesson.date': { $gte: firstMonday, $lte: lastSunday } } },
      {
        $group: {
          _id: '$teacher',
          monthlyExam: { $avg: '$monthlyExam' },
          count: { $count: {} }
        }
      },
      {
        $lookup: {
          from: 'users',
          foreignField: '_id',
          pipeline: [{ $match: { branch: req.user?.branch } }],
          localField: '_id',
          as: 'teacher'
        }
      },
      { $unwind: '$teacher' },
      {
        $lookup: {
          from: 'kpis',
          foreignField: 'teacher',
          localField: '_id',
          pipeline: [{ $match: { month: new Date(selectedMonth).toISOString().slice(0, 7) } }],
          as: 'kpi'
        }
      },
      { $unwind: { path: '$kpi', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          givenName: '$teacher.givenName',
          familyName: '$teacher.familyName',
          imageUrl: '$teacher.imageUrl',
          username: '$teacher.username',
          createdAt: '$teacher.createdAt',
          updatedAt: '$teacher.updatedAt',
          password: '$teacher.password',
          lastLogin: '$teacher.lastLogin',
          attend: '$kpi.attend',
          participation: '$kpi.participation',
          certificate: '$kpi.certificate',
          monthlyExam: 1,
          count: 1
        }
      }
    ])
    const teacherIds = teachers.map((el) => el._id)

    const teachers1 = await User.aggregate([
      {
        $match: {
          _id: { $nin: teacherIds },
          type: 'teacher',
          branch: req.user?.branch
        }
      },
      {
        $lookup: {
          from: 'kpis',
          foreignField: 'teacher',
          localField: '_id',
          pipeline: [{ $match: { month: new Date(selectedMonth).toISOString().slice(0, 7) } }],
          as: 'kpi'
        }
      },
      { $unwind: { path: '$kpi', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          givenName: 1,
          familyName: 1,
          imageUrl: 1,
          username: 1,
          createdAt: 1,
          updatedAt: 1,
          password: 1,
          lastLogin: 1,
          attend: '$kpi.attend',
          participation: '$kpi.participation',
          certificate: '$kpi.certificate'
        }
      }
    ])

    return res.status(200).json([...teachers, ...teachers1].sort((a, b) => a.givenName.localeCompare(b.givenName)))
  } catch (e) {
    errorLogger(req, res, e, '/get_teachers')
  }
})
router.post('/get_students', authMiddleware(['admin']), async (req, res) => {
  try {
    const { selectedMonth } = req.body
    const monthPricing = await Pricing.findOne({ month: selectedMonth?.slice(0, 7) })

    const students = await User.aggregate([
      { $match: { type: 'student', branch: req.user?.branch } },
      {
        $lookup: {
          from: 'pays',
          foreignField: 'student',
          localField: '_id',
          as: 'payments'
        }
      },
      {
        $lookup: {
          from: 'pays',
          foreignField: 'student',
          localField: '_id',
          pipeline: [{ $match: { pricing: monthPricing?._id } }],
          as: 'payment'
        }
      },
      { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
      { $unset: 'password' },
      { $sort: { givenName: 1 } }
    ])
    return res.status(200).json(students)
  } catch (e) {
    errorLogger(req, res, e, '/get_teachers')
  }
})
router.post('/get_disciplines', authMiddleware(['admin']), async (req, res) => {
  try {
    const disciplines = await Discipline.find({ branch: req.user?.branch })
    return res.status(200).json(disciplines)
  } catch (e) {
    errorLogger(req, res, e, '/get_disciplines')
  }
})
router.post('/get_connections', authMiddleware(), async (req, res) => {
  try {
    const { quarterId } = req.body
    if (req.user.type === 'student') {
      if (!req.user.active) return res.status(403).json({ message: 'user_inactive' })
      const quarter = await Quarter.findById(quarterId)

      const groups = await Group.find({ students: req.user._id })
      const groupIds = groups.map((el) => el._id)
      const connections = await Connection.aggregate([
        { $match: { $and: [{ group: { $in: groupIds } }, { active: true }] } },
        {
          $lookup: {
            from: 'lessons',
            foreignField: 'connection',
            localField: '_id',
            pipeline: [
              {
                $match: {
                  $or: [
                    { 'lessons.date': { $gte: quarter.startDate, $lte: quarter.endDate } },
                    { 'lessons.date': { $exists: false } },
                    { 'lessons.date': null }
                  ]
                }
              },
              { $match: { active: true } }
            ],
            as: 'lessons'
          }
        },
        { $unwind: { path: '$lessons', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'scores',
            foreignField: 'lesson',
            localField: 'lessons._id',
            pipeline: [{ $match: { student: new Types.ObjectId(req.user._id) } }],
            as: 'scores'
          }
        },
        { $unwind: { path: '$scores', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            scores: {
              $cond: {
                if: {
                  $and: [{ $gte: ['$lessons.date', quarter.startDate] }, { $lte: ['$lessons.date', quarter.endDate] }]
                },
                then: '$scores',
                else: null
              }
            }
          }
        },
        {
          $group: {
            _id: '$discipline',
            connection: { $first: '$_id' },
            active: { $first: '$active' },
            group: { $first: '$group' },
            teacher: { $first: '$teacher' },
            createdAt: { $first: '$createdAt' },
            updatedAt: { $first: '$updatedAt' },
            weeklyExam: {$avg: '$scores.weeklyExam'},
            score: { $avg: '$scores.score' },
            behavior: { $avg: '$scores.behavior' },
            homework: { $avg: '$scores.homework' },
            count: { $count: {} },
            attend: {
              $avg: {
                $cond: [{ $eq: ['$scores.attend', true] }, 100, { $cond: [{ $eq: ['$scores.attend', false] }, 0, null] }]
              }
            }
          }
        },
        { $addFields: { discipline: '$_id' } },
        { $addFields: { _id: '$connection' } },
        {
          $lookup: {
            from: 'users',
            foreignField: '_id',
            localField: 'teacher',
            as: 'teacher',
            pipeline: [{ $project: { password: 0 } }]
          }
        },
        { $lookup: { from: 'disciplines', foreignField: '_id', localField: 'discipline', as: 'discipline' } },
        { $unwind: '$teacher' },
        { $unwind: '$discipline' },
        { $sort: { _id: 1 } }
      ])
      return res.status(200).json(connections)
    }
    if (req.user.type === 'teacher') {
      const connections = await Connection.find({ teacher: req.user._id, active: true }).populate({
        path: 'discipline group'
      })
      return res.status(200).json(connections)
    }
    const connections = await Connection.find({ branch: req.user?.branch }).populate({
      path: 'discipline group teacher',
      select: '-password'
    })
    return res.status(200).json(connections)
  } catch (e) {
    errorLogger(req, res, e, '/get_connections')
  }
})
router.post('/get_group_connections', authMiddleware(), async (req, res) => {
  try {
    const { groupId } = req.body
    const connections = await Connection.find({ group: groupId, discipline: { $ne: null } }).populate({
      path: 'discipline'
    })
    return res.status(200).json(connections)
  } catch (e) {
    errorLogger(req, res, e, '/get_group_connections')
  }
})
router.post('/get_connection', authMiddleware(), async (req, res) => {
  try {
    const { connectionId } = req.body
    if (req.user.type === 'student') {
      if (!req.user.active) return res.status(403).json({ message: 'user_inactive' })
      const connection = await Connection.findById(connectionId).populate({
        path: 'discipline',
        select: '-students'
      })
      const transfers = await Transfer.find({$or: [{toGroup: connection.group?._id}, {fromGroup: connection.group?._id}]}).sort({date: 1})
      let params = {connection: connectionId, active: true}
      if (transfers.length) params = {
        connection: connectionId,
        active: true,
        $or: transfers.map(t => {
          console.log(t.fromGroup, connection.group?._id);
          console.log(t.fromGroup.toString() === connection.group?._id?.toString());

          if (t.fromGroup.toString() === connection.group?._id?.toString()) return {date: {$lt: t.date}}
          if (t.toGroup.toString() === connection.group?._id?.toString()) return {date: {$gte: t.date}}
        })
      }


      const lessons = await Lesson.find(params).populate({path: 'hours'}).sort({date: 1})
      return res.status(200).json({ ...connection._doc, lessons, scores: [] })
    } else {
      const connection = await Connection.findById(req.body.connectionId).populate({
        path: 'group',
        populate: { path: 'students', options: { sort: { givenName: 1 } }, select: '-password' }
      })

      const lessons = await Lesson.find({ connection: req.body.connectionId }).populate({ path: 'hours' }).sort({ date: 1 })
      const transfers = await Transfer.find({$or: [{toGroup: connection.group?._id}, {fromGroup: connection.group?._id}]}).sort({date: 1})
      return res.status(200).json({...connection._doc, lessons, transfers, scores: []})
    }
  } catch (e) {
    errorLogger(req, res, e, '/get_connection')
  }
})
router.post('/get_scores', authMiddleware(), async (req, res) => {
  try {
    const { lessonId, connectionId } = req.body
    if (req.user.type === 'student') {
      const lessons = await Lesson.find({ connection: connectionId, active: true })
      const lessonIds = lessons.map((el) => el._id)
      const scores = await Score.find({ lesson: { $in: lessonIds }, student: req.user._id })
      return res.status(200).json(scores)
    }
    const scores = await Score.find({ lesson: lessonId })
    return res.status(200).json(scores)
  } catch (e) {
    errorLogger(req, res, e, '/get_scores')
  }
})
router.post('/get_hours', authMiddleware(), async (req, res) => {
  try {
    const hours = await Hours.find({ branch: req.user?.branch })
    return res.status(200).json(hours)
  } catch (e) {
    errorLogger(req, res, e, '/get_hours')
  }
})
router.post('/get_quarters', authMiddleware(), async (req, res) => {
  try {
    const quarters = await Quarter.find({ branch: req.user?.branch })
    return res.status(200).json(quarters)
  } catch (e) {
    errorLogger(req, res, e, '/get_quarters')
  }
})
router.post('/get_calendar', authMiddleware(), async (req, res) => {
  try {
    let connectionIds = []
    if (req.user.type === 'student') {
      if (!req.user.active) return res.status(403).json({ message: 'user_inactive' })
      const groups = await Group.find({ students: req.user._id })
      const groupIds = groups.map((el) => el._id)
      const connections = await Connection.find({ group: { $in: groupIds } })
      connectionIds = connections.map((el) => el._id)
      const calendar = await Lesson.find({ connection: { $in: connectionIds }, active: true })
        .populate({ path: 'hours' })
        .populate({ path: 'connection', populate: { path: 'group discipline teacher', select: '-password -students' } })
      return res.status(200).json(calendar)
    }
    if (req.user.type === 'teacher') {
      const connections = await Connection.find({ teacher: req.user._id })
      connectionIds = connections.map((el) => el._id)
      const calendar = await Lesson.find({ connection: { $in: connectionIds } })
        .populate({ path: 'hours' })
        .populate({ path: 'connection', populate: { path: 'group discipline', select: '-students' } })
      return res.status(200).json(calendar)
    }
  } catch (e) {
    errorLogger(req, res, e, '/get_calendar')
  }
})
router.post('/get_finances', authMiddleware('admin'), async (req, res) => {
  try {
    const { selectedMonth } = req.body
    const { firstDay, lastDay } = getFirstLastDay(selectedMonth, true)
    const finances = await Finance.find({ branch: req.user?.branch, createdAt: { $gte: firstDay, $lte: lastDay } })
      .populate({ path: 'user', select: '-password' })
      .sort({ createdAt: 1 })
    return res.status(200).json(finances)
  } catch (e) {
    errorLogger(req, res, e, '/get_disciplines')
  }
})
router.post('/get_finances_chart', authMiddleware('admin'), async (req, res) => {
  try {
    const { selectedMonth } = req.body
    const { firstDay, lastDay } = getFirstLastDay(selectedMonth, true)

    const barChart = await Finance.aggregate([
      { $match: { branch: req.user?.branch, createdAt: { $gte: firstDay, $lte: lastDay } } },
      {
        $addFields: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }
      },
      {
        $group: {
          _id: { date: '$date', type: '$type' },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.date', // Regroup by date
          totals: {
            $push: {
              k: '$_id.type',
              v: '$totalAmount'
            }
          }
        }
      },
      {
        $addFields: {
          totals: {
            $arrayToObject: '$totals'
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totals: 1
        }
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [{ date: '$date' }, '$totals']
          }
        }
      },
      { $sort: { date: 1 } }
    ])
    const pieChart = await Finance.aggregate([
      { $match: { branch: req.user?.branch, createdAt: { $gte: firstDay, $lte: lastDay } } },
      {
        $group: {
          _id: {
            $cond: {
              if: { $gt: ['$amount', 0] },
              then: '$source',
              else: '$type'
            }
          },
          value: { $sum: '$amount' }
        }
      }
      // {
      //   $project: {
      //     _id: '$type',
      //     total: '$amount' }
      //   }
      // }
    ])
    return res.status(200).json({ barChart, pieChart })
  } catch (e) {
    errorLogger(req, res, e, '/get_disciplines')
  }
})
router.post('/get_pricing', authMiddleware('admin'), async (req, res) => {
  try {
    const pricing = await Pricing.find({ branch: req.user?.branch }).sort({ month: 1 })
    return res.status(200).json(pricing)
  } catch (e) {
    errorLogger(req, res, e, '/get_pricing')
  }
})

////////////////////////////////////////////////////////////////////////////////////////////ADD/////
router.post('/add_teacher', authMiddleware(['admin']), async (req, res) => {
  try {
    let {familyName, givenName, username, imageUrl, password} = req.body
    const user = await User.findOne({ username })
    if (user) return res.status(409).json({ message: 'username_taken' })

    const teacher = await User.create([
      { type: 'teacher', givenName, familyName, username, imageUrl, password, branch: req.user?.branch}
    ])
    return res.status(200).json(teacher)
  } catch (e) {
    errorLogger(req, res, e, '/add_teacher')
  }
})
router.post('/add_student', authMiddleware(['admin']), async (req, res) => {
  try {
    let { familyName, givenName, username, groupId, active, password } = req.body
    const user = await User.findOne({ username })
    if (user) return res.status(409).json({ message: 'username_taken' })
    const student = await User.create([
      { username, type: 'student', givenName, familyName, password, active, branch: req.user?.branch }
    ])
    const group = await Group.findByIdAndUpdate(groupId, { $push: { students: student } }, { new: true })
    return res.status(200).json(group)
  } catch (e) {
    errorLogger(req, res, e, '/add_teacher')
  }
})
router.post('/add_students', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { group, students, indexes } = req.body
    if (indexes) {
      await Group.findByIdAndUpdate(group, { students }, { new: true })
      return res.status(200).json('saved')
    }
    session.startTransaction()
    const addedStudents = []
    for (let { username, password, givenName, familyName } of students) {
      password = password?.trim?.() || generatePassword()
      username = username || familyName.toLowerCase() + '_' + givenName.toLowerCase()
      const newUser = await User.create(
        [{ username, givenName, familyName, password, type: 'student', branch: req.user?.branch }],
        { session }
      )
      addedStudents.push(newUser?.[0]._id)
    }
    if (!addedStudents.every((el) => el)) throw 1
    await Group.findByIdAndUpdate(group, { students: addedStudents }, { new: true })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('saved')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/add_students')
  }
})
router.post('/transfer_student', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const {fromGroup, toGroup, student} = req.body
    session.startTransaction()
    const date = new Date()
    await Transfer.create([{fromGroup, toGroup, student, date}], {session})
    await Group.findByIdAndUpdate(toGroup, {$addToSet: {students: student}}, {session})
    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('saved')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/add_students')
  }
})
router.post('/add_group', authMiddleware(['admin']), async (req, res) => {
  try {
    const { title } = req.body
    const group = await Group.create([{ title, branch: req.user?.branch }])
    return res.status(200).json(group)
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/add_discipline', authMiddleware(['admin']), async (req, res) => {
  try {
    const { title } = req.body
    const discipline = await Discipline.create([{ title, branch: req.user?.branch }])
    return res.status(200).json(discipline)
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/add_connection', authMiddleware(['admin']), async (req, res) => {
  try {
    const { teacher, discipline, group } = req.body
    const connection = await Connection.findOneAndUpdate(
      { teacher, discipline, group },
      { branch: req.user?.branch },
      { upsert: true }
    )
    return res.status(200).json(connection)
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/add_hours', authMiddleware(['admin']), async (req, res) => {
  try {
    const { startTime, endTime } = req.body
    const hours = await Hours.create([{ startTime, endTime, branch: req.user?.branch }])
    return res.status(200).json(hours)
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/add_quarter', authMiddleware(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.body
    const quarter = await Quarter.create([{ startDate, endDate, branch: req.user?.branch }])
    return res.status(200).json(quarter)
  } catch (e) {
    errorLogger(req, res, e, '/add_quarter')
  }
})
router.post('/add_lesson', authMiddleware(['admin', 'teacher']), async (req, res) => {
  try {
    const lessons = await Lesson.insertMany(req.body.lessons)
    return res.status(200).json(lessons)
  } catch (e) {
    errorLogger(req, res, e, '/add_lesson')
  }
})
router.post('/add_pricing', authMiddleware(['admin']), async (req, res) => {
  try {
    const { month, price1, price2, price3 } = req.body
    const price = await Pricing.findOneAndUpdate({ month, branch: req.user?.branch }, { price1, price2, price3 }, { new: true, upsert: true })
    return res.status(200).json(price)
  } catch (e) {
    errorLogger(req, res, e, '/add_pricing')
  }
})
router.post('/add_finance', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { type, amount, isIncome, source, description, teacher = '', student = '', monthly = {}, sPrice } = req.body
    session.startTransaction()
    if (type === 'student_pay') {
      for (const k of Object.keys(monthly)) {
        await Pay.findOneAndUpdate({ pricing: k, student }, { ...monthly[k], sPrice }, { upsert: true, new: true, session })
      }
      await Finance.create([{ type, amount, source, description, user: student, branch: req.user?.branch }], { session })
    } else if (type === 'teacher_salary') {
      await Finance.create([{ type, amount: amount * -1, description, user: teacher, branch: req.user?.branch }], { session })
    } else {
      await Finance.create(
        [{ type, source, amount: amount * (isIncome ? 1 : -1), description, branch: req.user?.branch }],
        { session }
      )
    }

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('saved')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/add_finance')
  }
})

/////////////////////////////////////////////////////////////////////////////////////////DELETE/////

router.post('/delete_hours', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { hoursId } = req.body
    session.startTransaction()
    await Hours.findByIdAndDelete(hoursId, { session })
    await Lesson.updateMany({ hours: hoursId }, { hours: null, active: false }, { session })
    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_quarter', authMiddleware(['admin']), async (req, res) => {
  try {
    const { quarterId } = req.body
    await Quarter.findByIdAndDelete(quarterId)
    return res.status(200).json('deleted')
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_discipline', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { disciplineId } = req.body
    session.startTransaction()

    await Discipline.findByIdAndDelete(disciplineId, { session })
    const connections = await Connection.find({ discipline: disciplineId })
    const connectionIds = connections.map((el) => el._id)
    await Lesson.updateMany({ connection: { $in: connectionIds } }, { active: false }, { session })
    await Connection.updateMany({ discipline: disciplineId }, { discipline: null, active: false }, { session })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_teacher', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { teacherId } = req.body
    session.startTransaction()

    await User.findByIdAndDelete(teacherId, { session })
    const connections = await Connection.find({ teacher: teacherId })
    const connectionIds = connections.map((el) => el._id)
    await Lesson.updateMany({ connection: { $in: connectionIds } }, { active: false }, { session })
    await KPI.deleteMany({teacher: teacherId}, {session})
    await Connection.updateMany({ teacher: teacherId }, { teacher: null, active: false }, { session })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_student', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { studentId } = req.body
    session.startTransaction()

    await User.findByIdAndDelete(studentId, { session })
    await Score.deleteMany({ student: studentId }, { session })
    await Group.updateMany({ students: studentId }, { $pull: { students: studentId } }, { session })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_lesson', authMiddleware(['admin', 'teacher']), async (req, res) => {
  const session = await startSession()
  try {
    const { lessonId } = req.body
    session.startTransaction()

    await Lesson.findByIdAndDelete(lessonId, { session })
    await Score.deleteMany({ lesson: lessonId })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_group', authMiddleware(['admin']), async (req, res) => {
  try {
    const { groupId } = req.body
    const group = await Group.findOne({ _id: groupId, students: { $exists: true, $ne: [] } })
    if (group) return res.status(409).json('not empty')
    await Group.findByIdAndDelete(groupId)
    return res.status(200).json('deleted')
  } catch (e) {
    errorLogger(req, res, e, '/user/create')
  }
})
router.post('/delete_connection', authMiddleware(['admin']), async (req, res) => {
  const session = await startSession()
  try {
    const { connectionId } = req.body
    session.startTransaction()

    await Connection.findByIdAndDelete(connectionId, { session })
    const lessons = await Lesson.find({ connection: connectionId })
    const lessonIds = lessons.map((el) => el._id)
    await Score.deleteMany({ lesson: { $in: lessonIds } }, { session })
    await Lesson.deleteMany({ connection: connectionId }, { session })

    await session.commitTransaction()
    await session.endSession()
    return res.status(200).json('deleted')
  } catch (e) {
    await session.abortTransaction()
    await session.endSession()
    errorLogger(req, res, e, '/user/create')
  }
})

/////////////////////////////////////////////////////////////////////////////////////////UPDATE/////
router.post('/change_user', authMiddleware(), async (req, res) => {
  try {
    const { userId, givenName, familyName, imageUrl, username, password, active } = req.body
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ message: 'not found' })
    if (username && user.username !== username) {
      const user2 = await User.findOne({ username })
      if (user2) return res.status(409).json({ message: 'username_taken' })
    }

    user.givenName = givenName || user.givenName
    user.familyName = familyName || user.familyName
    user.imageUrl = imageUrl || user.imageUrl
    user.username = username || user.username
    user.password = password || user.password
    user.active = typeof active === 'boolean' ? active : user.active
    user.save()

    res.status(202).json(user)
  } catch (e) {
    errorLogger(req, res, e, '/user/change')
  }
})
router.post('/change_score', authMiddleware(['admin', 'teacher']), async (req, res) => {
  try {
    const { lesson, score, scoreType, student } = req.body
    const { connection } = await Lesson.findById(lesson).populate({
      path: 'connection'
    })

    const score1 = await Score.findOneAndUpdate(
      { lesson, student },
      { [scoreType]: score, teacher: connection.teacher },
      { upsert: true, new: true }
    )
    return res.status(200).json(score1)
  } catch (e) {
    errorLogger(req, res, e, '/change_score')
  }
})
router.post('/assign_homework', authMiddleware(['student']), async (req, res) => {
  try {
    const { lessonId, homework } = req.body

    const lesson = await Lesson.findById(lessonId)
    if (new Date(lesson?.homeworkEnd).getTime() < new Date().getTime()) {
      return res.status(500).json({ message: 'deadline_passes' })
    }

    const score = await Score.findOneAndUpdate(
      { lesson: lessonId, student: req.user._id },
      { assign: homework },
      { upsert: true, new: true }
    )
    return res.status(200).json(score)
  } catch (e) {
    errorLogger(req, res, e, '/assign_homework')
  }
})
router.post('/change_kpi', authMiddleware(['admin']), async (req, res) => {
  try {
    const { teacherId, score, scoreType, month } = req.body
    const score1 = await KPI.findOneAndUpdate({ teacher: teacherId, month }, { [scoreType]: score }, { upsert: true, new: true })
    return res.status(200).json(score1)
  } catch (e) {
    errorLogger(req, res, e, '/change_kpi')
  }
})
router.post('/change_discipline', authMiddleware(['admin']), async (req, res) => {
  try {
    const { disciplineId, title } = req.body
    const discipline = await Discipline.findByIdAndUpdate(disciplineId, { title })
    return res.status(200).json(discipline)
  } catch (e) {
    errorLogger(req, res, e, '/change_discipline')
  }
})
router.post('/change_hours', authMiddleware(['admin']), async (req, res) => {
  try {
    const { hourId, startTime, endTime } = req.body
    const hour = await Hours.findByIdAndUpdate(hourId, {
      startTime,
      endTime
    })
    return res.status(200).json(hour)
  } catch (e) {
    errorLogger(req, res, e, '/change_hours')
  }
})
router.post('/change_quarter', authMiddleware(['admin']), async (req, res) => {
  try {
    const { quarterId, startDate, endDate } = req.body
    const quarter = await Quarter.findByIdAndUpdate(quarterId, {
      startDate,
      endDate
    })
    return res.status(200).json(quarter)
  } catch (e) {
    errorLogger(req, res, e, '/change_quarter')
  }
})
router.post('/change_group', authMiddleware(['admin']), async (req, res) => {
  try {
    const { groupId, title } = req.body
    const group = await Group.findByIdAndUpdate(groupId, { title })
    return res.status(200).json(group)
  } catch (e) {
    errorLogger(req, res, e, '/change_group')
  }
})
router.post('/change_lesson', authMiddleware(['admin', 'teacher']), async (req, res) => {
  try {
    let { lessonId, title, hours, date, homework, homeworkStart, homeworkEnd, active, type } = req.body

    homeworkEnd = new Date(homeworkEnd || null)
    homeworkEnd = new Date(homeworkEnd.setHours(23))
    homeworkEnd = new Date(homeworkEnd.setMinutes(59))
    homeworkEnd = new Date(homeworkEnd.setSeconds(59))

    const lesson = await Lesson.findById(lessonId)
    lesson.title = title
    lesson.active = title ? active : false
    lesson.hours = hours || lesson.hours
    lesson.date = date || lesson.date
    lesson.type = type || lesson.type
    lesson.homework = homework
    lesson.homeworkStart = homeworkStart
    lesson.homeworkEnd = homeworkEnd
    lesson.save()
    return res.status(200).json(lesson)
  } catch (e) {
    errorLogger(req, res, e, '/change_lesson')
  }
})
router.post('/change_connection', authMiddleware(['admin']), async (req, res) => {
  try {
    const { connectionId, discipline, teacher, group } = req.body
    const connection = await Lesson.findByIdAndUpdate(connectionId, { discipline, teacher, group }, { new: true })
    return res.status(200).json(connection)
  } catch (e) {
    errorLogger(req, res, e, '/change_lesson')
  }
})

router.post('/disable_debtors', authMiddleware(['admin']), async (req, res) => {
  try {
    const pricing = await Pricing.findOne({ month: new Date().toISOString().slice(0, 7) })
    if (!pricing?._id) return res.status(400).json({ message: 'month_no_price' })
    const currentMonthPayments = await Pay.find({ pricing: pricing._id })
    const fullyPaidStudents = currentMonthPayments.filter((el) => {
      const discount = el?.type === 'percent' ? (el?.discount * pricing.price) / 100 : el?.discount || 0
      return el.amount >= pricing.price - discount
    })

    await User.updateMany(
      { type: 'student', branch: req.user?.branch, _id: { $nin: fullyPaidStudents.map((el) => el.student) } },
      { active: false }
    )

    return res.status(200).json({ currentMonthPayments, fullyPaidStudents })
  } catch (e) {
    errorLogger(req, res, e, '/change_lesson')
  }
})

module.exports = router
