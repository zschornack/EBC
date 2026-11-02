// PERGUNTAS DO TESTE DE NIVELAMENTO
// Usado em dois lugares: na página /nivelamento (para mostrar as perguntas)
// e no backend (para montar o e-mail com acertos e erros).
//
// O GABARITO NÃO FICA AQUI: ele fica em functions/api/_gabarito.js, que não é publicado no site.
// Se mudar, acrescentar ou tirar alguma pergunta, atualize o gabarito também (mesma ordem!).
//
// Cada bloco tem um nível (A1 = iniciante ... C1 = avançado). As opções viram a), b), c), d) automaticamente.

export const BLOCKS = [
  {
    level: 'A1',
    questions: [
      { q: 'Choose the correct sentence:', options: ['She go to work every day.', 'She goes to work every day.', 'She going to work every day.'] },
      { q: 'I _____ a cat.', options: ['has', 'have', 'having'] },
      { q: 'They _____ happy.', options: ['am', 'is', 'are'] },
      { q: 'Choose the correct question:', options: ['You like watching YouTube?', 'Do you like watching YouTube?', 'Like you watching YouTube?'] },
      { q: 'He _____ coffee every morning.', options: ['drink', 'drinks', 'drinking'] },
      { q: 'Choose the correct answer:', options: ['How are you? – I am good.', 'How are you? – She is good.', 'How are you? – You are good.'] },
      { q: 'We _____ to the park at weekends.', options: ['go', 'goes', 'going'] },
      { q: 'Which sentence is correct?', options: ['I can to help you.', 'I can help you.', 'I helping you.'] },
      { q: 'This is _____ book.', options: ['my', 'mine', 'me'] },
    ],
  },
  {
    level: 'A2',
    questions: [
      { q: 'I _____ to the cinema last night.', options: ['go', 'going', 'went'] },
      { q: 'You _____ take an umbrella with you; it looks like it might rain later.', options: ['can', 'should', 'must', 'could'] },
      { q: 'He has _____ his homework.', options: ['finish', 'finished', 'finishing'] },
      { q: 'I _____ this film.', options: ['already saw', 'have already seen', 'am already see'] },
      { q: 'Choose the best sentence:', options: ['She is watching her favourite series on Netflix.', 'She watch her favourite series on Netflix.', 'She watching her favourite series on Netflix.'] },
      { q: 'How do you ask this correctly?', options: ['Where coffee shop is?', 'Where the coffee shop is?', 'Where is the coffee shop?'] },
      { q: 'If it _____ (rain) tomorrow, we will cancel the picnic.', options: ['rains', 'rained', 'is raining', 'will rain'] },
      { q: 'I _____ (chat) with my friend on WhatsApp when the internet connection dropped.', options: ['chatted', 'was chatting', 'am chatting', 'chat'] },
    ],
  },
  {
    level: 'B1',
    questions: [
      { q: 'Choose the correct sentence:', options: ['If I were you, I would work remotely.', 'If I was you, I will work remotely.', 'If I am you, I would work remotely.'] },
      { q: 'I’m looking forward to _____ you at the conference.', options: ['seeing', 'see', 'seen'] },
      { q: 'How do you say this correctly?', options: ['She said that she will attend the online course.', 'She said that she would attend the online course.', 'She said that she should have attend the online course.'] },
      { q: 'Choose the best option:', options: ['Despite the delay, they launched the app on time.', 'Although the delay, they launched the app on time.', 'However the delay, they launched the app on time.'] },
      { q: 'If she _____ harder, she would have passed the exam.', options: ['studied', 'studies', 'had studied'] },
      { q: 'Choose the correct sentence:', options: ['I’ve been learning English for two years.', 'I’m learning English since two years.', 'I learn English for two years.'] },
      { q: 'How do you say this correctly?', options: ['He’s been working from home since March.', 'He works from home since March.', 'He working from home since March.'] },
      { q: 'Choose the correct sentence:', options: ['She has never tried vegan food before.', 'She never has tried vegan food before.', 'She has tried never vegan food before.'] },
      { q: 'The woman _____ lives next door is a famous author.', options: ['what', 'which', 'whose', 'who'] },
      { q: 'The movie was so _____ that everyone in the theatre was _____.', options: ['bored / boring', 'boring / bored', 'bored / bored', 'boring / boring'] },
      { q: 'Can you _____ (take care of) my dog while I’m away this weekend?', options: ['look after', 'look for', 'look into', 'look down on'] },
    ],
  },
  {
    level: 'B2',
    questions: [
      { q: 'Choose the correct sentence:', options: ['I’ve been working remotely for two years.', 'I’ve been working remotely since two years.', 'I’ve worked remotely two years ago.'] },
      { q: 'Which is the best variant?', options: ['The company will launch its new app next week.', 'The company will launching its new app next week.', 'The company is launching its new app next week.'] },
      { q: 'It’s important _____ a healthy work-life balance.', options: ['to find', 'finding', 'find'] },
      { q: 'Choose the correct option:', options: ['In spite that there were challenges, they managed to finish the project.', 'Although the challenges, they managed to finish the project.', 'Despite the challenges, they managed to finish the project.'] },
      { q: 'Which sentence is correct?', options: ['If she hadn’t been so busy, she would have joined the meeting.', 'If she wasn’t so busy, she would have joined the meeting.', 'If she hasn’t been so busy, she would have joined the meeting.'] },
      { q: 'Choose the correct sentence:', options: ['He suggested meeting at 6 PM.', 'He suggested to meet at 6 PM.', 'He suggested meet at 6 PM.'] },
      { q: 'I _____ the report by tomorrow morning.', options: ['will finish', 'will have finished', 'finish'] },
      { q: 'Choose the correct sentence:', options: ['I prefer working from home rather than commuting every day.', 'I prefer work from home rather than commuting every day.', 'I prefer to working from home rather than commuting every day.'] },
      { q: 'By the time we arrived, the documents _____ (already send) to the client.', options: ['had already sent', 'had already been sent', 'were already sent', 'have already been sent'] },
      { q: 'You _____ have left your keys at the office because they aren’t here.', options: ['must', 'might', 'can’t', 'could'] },
      { q: 'By the time we arrived at the cinema, the movie _____ (already start).', options: ['had already started', 'already started', 'has already started', 'was already starting'] },
      { q: 'The meeting was scheduled to start at 9 AM, but it was _____ (postponed) until 11 AM.', options: ['taken off', 'put off', 'set down', 'brought up'] },
    ],
  },
  {
    level: 'C1',
    questions: [
      { q: 'Which sentence is correct?', options: ['Had I known about the delay, I would have taken an earlier train.', 'If I would have known about the delay, I would have taken an earlier train.', 'Had I knew about the delay, I would have taken an earlier train.'] },
      { q: 'Not until the deadline was extended _____ I manage to complete the report.', options: ['had', 'was', 'did', 'would'] },
      { q: 'Choose the correct sentence:', options: ['She accused him of having stolen the money.', 'She accused him of having stealing the money.', 'She accused him of stolen the money.'] },
      { q: 'Which is correct?', options: ['It’s time we leave.', 'It’s time we left.', 'It’s time we are leaving.'] },
      { q: 'Not only _____, but she’s very friendly as well.', options: ['is she intelligent', 'she is intelligent', 'she intelligent'] },
      { q: 'Choose the best option:', options: ['Hardly had he arrived when the meeting started.', 'Hardly he had arrived when the meeting started.', 'Hardly had he arrived than the meeting started.'] },
      { q: 'Complete the sentence: _____ I practice, I can’t seem to master this piece.', options: ['As much as', 'However', 'Though', 'Considering'] },
      { q: 'Which sentence is correct?', options: ['If only I had known about the traffic, I would have left earlier.', 'If only I had knew about the traffic, I would have left earlier.', 'If only I would have known about the traffic, I would have left earlier.'] },
      { q: 'Choose the best sentence:', options: ['The more you are practising, the better you get.', 'The more you practise, the better you get.', 'The more you will practice, the better you get.'] },
      { q: 'Scarcely had I opened the door _____ it started raining.', options: ['when', 'then', 'that'] },
      { q: 'Choose the correct sentence:', options: ['It’s essential that he be informed immediately.', 'It’s essential that he is informed immediately.', 'It’s essential that he should be informed immediately.'] },
      { q: 'She acts _____ she owns the place.', options: ['as if', 'like', 'as'] },
    ],
  },
];
