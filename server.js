const fs = require('fs');
const express = require('express');
const path = require('path');
const port = process.env.PORT || 8080;
const mysql = require('mysql2');
require('dotenv').config();

const encoder = require('./encoder');

// Параметры входа в БД
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_NAME = process.env.DB_NAME;
const DB_PASSWORD = process.env.DB_PASSWORD;

const app = express();

const jsonParser = express.json();

// Отдаём статику
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'build')));

// Do Result and Update Answers
app.get("/do-results-update-answers/:test_id", function(request, response){

    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        const sql_zero = `CALL F_DoResultUpdateAnswers(${accessStatus.vk_user_id}, ${request.params.test_id});`;
           
        connection.query(sql_zero, function(error, results) {
            if (error) {
                console.log(error);
            }
            else {
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (do-results-update-answers)");
                });
    
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: 'do_res and upd_ans success' }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});

// "Авторизация" пользователя в БД
app.get("/user-db-auth", function(request, response){

    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        const sql_zero = `CALL F_UserAuth(${accessStatus.vk_user_id});`;
           
        connection.query(sql_zero, function(error, results) {
            if (error) {
                console.log(error);
            }
            else {
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (user-db-auth)");
                });
    
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: 'auth success' }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});

// Получение обработанных результатов
app.get("/get-processed-result/:test_id", function(request, response){
    
    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        let processed_data = [];
    
    
        const sql_zero = `SELECT Result_ID, VK_ID, Test_ID, Factor, Value, Reply_Date FROM result
                                WHERE VK_ID = ${accessStatus.vk_user_id} AND Test_ID = ${request.params.test_id} AND 
                                    Reply_Date = (SELECT MAX(Reply_Date) FROM result WHERE VK_ID = ${accessStatus.vk_user_id} AND Test_ID = ${request.params.test_id})
                            UNION ALL
                            SELECT PMA.Person_MultiAnswer_ID AS Result_ID, PMA.VK_ID AS VK_ID, Q.Test_ID AS Test_ID, 
                                    PMA.Question_ID AS Factor, PMA.Answer AS Value, PMA.Reply_Date AS Reply_Date
                                FROM Person_MultiAnswer AS PMA, Question AS Q 
                                WHERE PMA.Question_ID = Q.Question_ID AND PMA.VK_ID = ${accessStatus.vk_user_id}
                                    AND Q.Test_ID = ${request.params.test_id} AND PMA.Status = 1
                                    AND PMA.Reply_Date IN 
                                        (SELECT MAX(PMA.Reply_Date) 
                                        FROM Person_MultiAnswer AS PMA, Question AS Q
                                            WHERE PMA.Question_ID = Q.Question_ID AND PMA.VK_ID = ${accessStatus.vk_user_id} AND Q.Test_ID = ${request.params.test_id} AND PMA.Status = 1
                                                GROUP BY PMA.Question_ID);`;
    
        connection.query(sql_zero, function(error, results) {
            if (error)
                console.log(error);
            else {
    
                if (results.length == 0) {
                    // Ничего не делаем
                }
                // Обработка по "сырым" результатам
                else if (request.params.test_id == 1) {
    
                    // Обработка результатов теста на Психологическую Защиту
    
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Защитные механизмы',
                        section_explanation: 'Защитные механизмы: что это и зачем они нужны людям? Все переживания и травмирующие события так или иначе остаются в памяти. Поэтому наш мозг придумал эффективный метод борьбы с ними – защитные механизмы. Если у Вас произошла ситуация, которая привела к состоянию тревоги, дискомфорту, внутреннему конфликту, то Вы неосознанно используете защитный механизм, чтобы в дальнейшем даже не обращать внимания на такие мелочи.',
                        factors: []
                    }
                    
                    for (let i = 0; i < results.length; i++) {
                        
                        if (results[i].Factor == 'Вытеснение') {
                            processed_data[0].factors[i] = {
                                name: 'Вытеснение',
                                description: `${(results[i].Value * 100 / 12).toFixed(0)}%`,
                                clarification: 'Вытеснение – это неосознанное устранение травмирующих событий в самую глубину личности, так что человек без помощи психолога не сможет их вспомнить.'
                            }
                        }
                        else if (results[i].Factor == 'Гиперкомпенсация') {
                            processed_data[0].factors[i] = {
                                name: 'Гиперкомпенсация',
                                description: `${(results[i].Value * 100 / 10).toFixed(0)}%`,
                                clarification: 'Гиперкомпенсация (реактивные образования) – это механизм психологической защиты, характеризующийся обратным действием. То есть человек подавляет неприятное событие так, что на уровне сознания оно проявляется противоположным образом.'
                            }
                        }
                        else if (results[i].Factor == 'Замещение') {
                            processed_data[0].factors[i] = {
                                name: 'Замещение',
                                description: `${(results[i].Value * 100 / 12).toFixed(0)}%`,
                                clarification: 'Замещение появляется, когда человек не может проявить свою агрессию на другого человека, становясь из-за этого недовольным другими. Например, не имея возможности выразить свое возмущение начальнику, человек неосознанно возмущается поведением своих подчиненных, пытаясь так компенсировать свое возмущение.'
                            }
                        }
                        else if (results[i].Factor == 'Компенсация') {
                            processed_data[0].factors[i] = {
                                name: 'Компенсация',
                                description: `${(results[i].Value * 100 / 10).toFixed(0)}%`,
                                clarification: 'Компенсация – это замена своего недостатка с помощью присвоения свойств, характеристик, умений другого человека и выдачи их за свои. Если настойчивая работа в определенном виде деятельности приводит к неудаче, человек копирует того, кто находится выше статусом.'
                            }
                        }
                        else if (results[i].Factor == 'Отрицание') {
                            processed_data[0].factors[i] = {
                                name: 'Отрицание',
                                description: `${(results[i].Value * 100 / 13).toFixed(0)}%`,
                                clarification: 'Отрицание – это механизм психологической защиты, который не принимает тревожную информацию, не признает ее как есть, искажает восприятие действительности, чтобы не нанести вред сознанию человека. Преобладает он при внезапных травмирующих ситуациях, чтобы психика могла привыкнуть к случившемуся.'
                            }
                        }
                        else if (results[i].Factor == 'Проекция') {
                            processed_data[0].factors[i] = {
                                name: 'Проекция',
                                description: `${(results[i].Value * 100 / 13).toFixed(0)}%`,
                                clarification: 'С помощью проекции человек переносит свои переживания, мысли и чувства на другого. В большей степени это те недостатки и промахи, за которые он испытывает вину.'
                            }
                        }
                        else if (results[i].Factor == 'Рационализация') {
                            processed_data[0].factors[i] = {
                                name: 'Рационализация',
                                description: `${(results[i].Value * 100 / 13).toFixed(0)}%`,
                                clarification: 'Рационализация (интеллектуализация) – это тот случай, когда человек ложно аргументирует свое поведение. Находясь в психологическом комфорте, он объясняет себе свои поступки, скрывая при этом истинные мотивы от себя самого.'
                            }
                        }
                        else if (results[i].Factor == 'Регрессия') {
                            processed_data[0].factors[i] = {
                                name: 'Регрессия',
                                description: `${(results[i].Value * 100 / 14).toFixed(0)}%`,
                                clarification: 'Регрессия – это возвращение на стадию ребенка. При опасной ситуации человек переходит к примитивным действиям (топает ногой, плачет на публику и т.д.). Он пытается обратить на себя внимание, не уступает оппоненту, становится упрямым, не хочет ничего обсуждать.'
                            }
                        }
                    }
                }
                else if (request.params.test_id == 11) {
                    
                    // Обработка результатов опросника Кеттелла
    
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Личностные черты',
                        section_explanation: 'Реймонд Бернар Кеттел создал теорию личностных черт, согласно которой личность – это устойчивая, постоянная и стабильная взаимосвязь всех элементов человека (характера, темперамента, черт), определяющая внутреннее составляющее и поведение в целом. В зависимости от выраженности личностных черт, различается и поведение людей.',
                        factors: []
                    }
    
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].Factor == 'A') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Общительность (Фактор А)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о склонности к ригидности, холодности, скептицизму и отчужденности. Такого человека вещи привлекают больше, чем люди. Он предпочитает работать сам, избегая компромиссов. Склонен к точности, ригидности в деятельности, личных установках. Во многих профессиях это желательно. Иногда склонен быть критически настроенным, несгибаемым, твердым, жестким.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о сдержанности, обособленности. Это критический, холодный человек.';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 14) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют об обращенности вовне, легкости в общении. О таком человеке можно сказать "участвующий аффективно".';
                            }
                            else if (results[i].Value >= 15 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о склонности к добродушию, легкости в общении, эмоциональному выражению. Такой человек готов к сотрудничеству, внимателен к людям, мягкосердечен, добр, приспособляем. Предпочитает ту деятельность, где есть занятия с людьми, ситуации с социальным значением. Легко включается в активные группы. Щедр в личных отношениях, не боится критики. Хорошо запоминает события, фамилии, имена и отчества.';
                            }
    
                        }
                        if (results[i].Factor == 'B') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Интеллект (Фактор В)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 5) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о склонности медленнее понимать материал при обучении. Предпочтению конкретной, буквальной интерпретации.';
                            }
                            else if (results[i].Value >= 6 && results[i].Value <= 8) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о конкретности мышления (меньшей способности к обучению).';
                            }
                            else if (results[i].Value == 9) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о развитом интеллекте, умении абстрактно мыслить, разумности (высокой способности к обучению).';
                            }
                            else if (results[i].Value >= 10 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о способности быстро воспринимать и усваивать новый учебный материал. Имеется некоторая корреляция с культурным уровнем, а также с реактивностью.';
                            }
    
                        }
                        if (results[i].Factor == 'C') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Эмоциональная устойчивость (Фактор С)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 9) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, которому не хватает энергии, он часто чувствует себя беспомощным, усталым и не способным справиться с жизненными трудностями. Такой человек может иметь беспричинные страхи, беспокойный сон и обиду на других, которая зачастую оказывается необоснованной. Такие люди не способны контролировать свои эмоциональные импульсы и выражать их в социально допустимой форме. В поведении это проявляется как отсутствие ответственности, капризность.';
                            }
                            else if (results[i].Value >= 10 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о чувствительности, меньшей устойчивости в эмоциальном плане. Такой человек легко расстраивается.';
                            }
                            else if (results[i].Value >= 14 && results[i].Value <= 18) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют об эмоциональной устойчивости. Они свойтсвенный человеку, трезво оценивающему действительность, активному, зрелому.';
                            }
                            else if (results[i].Value >= 19 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, который является эмоционально зрелым и хорошо приспособленным. Такой человек обычно способен достигать своих целей без особых трудностей, смело смотреть в лицо фактам, осознавать требования действительности. Он не скрывает от себя собственные недостатки, не расстраивается по пустякам и не поддается случайным колебаниям настроений.';
                            }
    
                        }
                        if (results[i].Factor == 'E') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Доминантность (Фактор E)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 9) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека послушного, конформного и зависимого. Такой человек руководствуется мнением окружающих, не может отстаивать свою точку зрения, следует за более доминантными и легко поддается авторитетам. Для его поведения характерны пассивность и подчинение своим обязанностям, отсутствие веры в себя и в свои возможности, склонность брать вину на себя. Низкая доминантность обычно связана с успешностью обучения во всех возрастных группах.';
                            }
                            else if (results[i].Value >= 10 && results[i].Value <= 14) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о скромности, покорности, мягкости, уступчивости. Такой человек является податливым, конформным, приспособляющимся.';
                            }
                            else if (results[i].Value >= 15 && results[i].Value <= 18) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о склонности к самоутверждению, независимости. Такой человек является агрессивным, упрямым (доминантным).';
                            }
                            else if (results[i].Value >= 19 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека властного, которому нравится доминировать и приказывать, контролировать и критиковать других людей. У такого человека выражено стремление к самоутверждению, самостоятельности и независимости, он живет по собственным соображениям, игнорируя социальные условности и авторитеты, агрессивно отстаивая права на самостоятельность и требуя проявления самостоятельности от других. Такая личность действует смело, энергично и активно, ей нравится "принимать вызовы" и чувствовать превосходство над другими.';
                            }
    
                        }
                        if (results[i].Factor == 'F') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Экспрессивность, беззаботность (Фактор F)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека ответственного, трезвого и серьезного в своем подходе к жизни. Но наряду с этим он склонен все усложнять и подходить ко всему слишком серьезно и осторожно. Его постоянно заботит будущее, последствия его поступков, возможности неудач и несчастий. Такому человеку тяжело расслабиться от защит, он старается планировать все свои действия.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о трезвости, осторожности, серьезности, молчаливости.';
                            }
                            else if (results[i].Value >= 14 && results[i].Value <= 17) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о безалаберности. Такой человек является импульсивно-живом, веселым, полным энтузиазма.';
                            }
                            else if (results[i].Value >= 18 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, который имеет более простой и оптимистичный характер, легко относится к жизни, верит в удачу, мало заботится о будущем. Такой человек часто демонстрирует находчивость и остроумность, получает удовольствие от вечеринок, зрелищных мероприятий, работы, предполагающей разнообразие, перемены, путешествия.';
                            }
    
                        }
                        if (results[i].Factor == 'G') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Нормативность поведения (Фактор G)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о тенденции к непостоянству цели, непринужденности в поведении. Такой человек не прилагает усилий к выполнению групповых задач, выполнению социально-культурных требований. Его свобода от влияния группы может вести к асоциальным поступкам, но временами делает его деятельность более эффективной. Отказ от подчинения правилам уменьшает соматические расстройства при стрессе.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 11) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, пользующегося моментом, ищущего выгоду в ситуации. Он избегает правил, чувствует себя малообязательным.';
                            }
                            else if (results[i].Value >= 12 && results[i].Value <= 15) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о сознательности, настойчивости. На такого человека можно положиться. Он степенный, обязательный.';
                            }
                            else if (results[i].Value >= 16 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, требовательного к себе, руководствующегося чувством долга, настойчивого. Он берет на себя ответственность, добросовестен, склонен к морализированию, предпочитает работящих людей, остроумный.';
                            }
    
                        }
                        if (results[i].Factor == 'H') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Смелость (Фактор H)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 6) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о застенчивости, уклончивости. Такой человек держится в стороне, «тушуется». Обычно он испытывает чувство собственной недостаточности. Речь замедленна, затруднена, высказывается трудно. Избегает профессий, связанных с личными контактами. Предпочитает иметь 1-2 близких друзей, не склонен вникать во все, что происходит вокруг него.';
                            }
                            else if (results[i].Value >= 7 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о застенчивости, сдержанности, неуверенности, боязливости, робости.';
                            }
                            else if (results[i].Value >= 13 && results[i].Value <= 18) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека-авантюриста, социально-смелого, незаторможенного, спонтанного.';
                            }
                            else if (results[i].Value >= 19 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека общительного, смелого, испытывающего новые вещи. Он спонтанный и живой в эмоциональной сфере. Его «толстокожесть» позволяет ему переносить жалобы и слезы, трудности в общении с людьми в эмоционально напряженных ситуациях. Может небрежно относиться к деталям, не реагировать на сигналы об опасности.';
                            }
    
                        }
                        if (results[i].Factor == 'I') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Чувствительность (Фактор I)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о практичности, реалистичности, мужественности, независимости. Такой человек имеет чувство ответственности, но скептически относится к субъективным и культурным аспектам жизни. Иногда безжалостный, жестокий, самодовольный. Руководя группой, заставляет ее работать на практической и реалистической основе.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 11) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека сильного, независимого. ОН полагается на себя, реалистичный, не терпит бессмысленности.';
                            }
                            else if (results[i].Value >= 12 && results[i].Value <= 15) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о слабости, зависимости, недостаточной самостоятельности, беспомощности, сензитивности.';
                            }
                            else if (results[i].Value >= 16 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека разборчивого, капризного, иногда требовательного к вниманию, помощи. Он зависимый, непрактичный. Не любит грубых людей и грубых профессий. Склонен замедлять деятельность группы и нарушать ее моральное состояние нереалистическим копанием в мелочах, деталях.';
                            }
    
                        }
                        if (results[i].Factor == 'L') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Подозрительность (Фактор L)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека склонного к свободе от тенденции ревности, приспособляемого, веселого. Он не стремится к конкуренции, заботится о других. Хорошо работает в группе.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о доверчивости, способности к адаптации, неревнивости, уживчивости.';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 14) {
                                processed_data[0].factors[i].description = 'Такие результаты характены для человека подозрительного, имеющего собственное мнение, не поддающегося обману.';
                            }
                            else if (results[i].Value >= 15 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека недоверчивого, сомневающегося, часто погруженного в свое «Я». Он упрямый, заинтересован во внутренней психической жизни. Осмотрителен в действиях, мало заботится о других людях, плохо работает в группе.';
                            }
    
                        }
                        if (results[i].Factor == 'M') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Мечтательность (Фактор М)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, беспокоящегося о том, чтобы поступать правильно, практично. Он руководствуется возможным, заботится о деталях, сохраняет присутствие духа в экстремальных ситуациях.';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о практичности. Они свойственны человеку тщательному, конвенциальному. Он управляем внешними реальными обстоятельствами.';
                            }
                            else if (results[i].Value >= 14 && results[i].Value <= 17) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о развитом воображении, погруженности во внутренние потребности, заботе о практических вопросах.';
                            }
                            else if (results[i].Value >= 18 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека склонного к неприятному для окружающих поведению (не каждодневному). Он не беспокоится о повседневных вещах, самомотивированный, обладает творческим воображением. Обращает внимание на «основное» и забывает о конкретных людях и реальностях. Изнутри направленные интересы иногда ведут к нереалистическим ситуациям, сопровождающимся экспрессивными взрывами. Индивидуальность ведет к отвержению его в групповой деятельности.';
                            }
    
                        }
                        if (results[i].Factor == 'N') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Дипломатичность (Фактор N)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 5) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о склонности к отсутствию утонченности, к сентиментальности и простоте. Такой человек иногда грубоват и резок, обычно естественен и спонтанен.';
                            }
                            else if (results[i].Value >= 6 && results[i].Value <= 8) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о прямоте, естественности, бесхитростности, сентиментальности.';
                            }
                            else if (results[i].Value >= 9 && results[i].Value <= 11) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о хитрости, нерасчетливости, светскости, проницательности (утонченности).';
                            }
                            else if (results[i].Value >= 12 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о утонченности, опытности, светскости, хитрости. Такой человек склонен к анализу. Предпочитает интеллектуальный подход к оценке ситуации, близкий к цинизму.';
                            }
    
                        }
                        if (results[i].Factor == 'O') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Тревожность (Фактор O)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека безмятежного, со спокойным настроением. Его трудно вывести из себя. Он невозмутимый, уверенный в себе и своих способностях. Гибкий, не чувствует угрозы, иногда до такой степени, что не чувствителен к тому, что группа идет другим путем и что он может вызвать неприязнь.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о безмятежности, доверчивости, спокойствии.';
                            }
                            else if (results[i].Value >= 14 && results[i].Value <= 17) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о тревожности, депрессивном, обеспокоенном состоянии (тенденции аутопунитивности), чувстве вины.';
                            }
                            else if (results[i].Value >= 18 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека депрессивного, у которого преобладают плохое настроение, мрачные предчувствия и размышления, беспокойство. Тенденция к тревожности в трудных ситуациях. Чувство, что его не принимает группа.';
                            }
    
                        }
                        if (results[i].Factor == 'Q1') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Экспериментирование (Фактор Q1)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 8) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека убежденного в правильности того, чему его учили. ОН принимает всё как проверенное, несмотря на противоречия. Склонен к осторожности и к компромиссам в отношении новых людей. Имеет тенденцию препятствовать и противостоять изменениям и откладывать их, придерживается традиций.';
                            }
                            else if (results[i].Value >= 9 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о консервативности, уважении принципов, терпимости к традиционным трудностям.';
                            }
                            else if (results[i].Value >= 13 && results[i].Value <= 16) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека экспериментирующего, критического, либерального, аналитического, свободно мыслящего.';
                            }
                            else if (results[i].Value >= 17 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о поглощенности интеллектуальными проблемами. Такой человек имеет сомнения по различным фундаментальным вопросам. Он скептичен и старается вникнуть в сущность идей старых и новых. Он часто лучше информирован, менее склонен к морализированию, более – к эксперименту в жизни, терпим к несообразностям и к изменениям.';
                            }
    
                        }
                        if (results[i].Factor == 'Q2') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Независимость (Фактор Q2)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 6) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, предпочитаюшего работать и принимать решения вместе с другими людьми. Он любит общение и восхищение, зависит от них. Склонен идти с группой. Необязательно общителен, скорее ему нужна поддержка со стороны группы.';
                            }
                            else if (results[i].Value >= 7 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о зависимости от группы. Такой человек является «присоединяющимся», ведомым, идущим на зов (групповая зависимость)';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 14) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о самоудовлетворенности, склонности предлагать собственное решение, предприимчивости.';
                            }
                            else if (results[i].Value >= 15 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека независимого, склонного идти собственной дорогой, принимать собственные решения, действовать самостоятельно. Он не считается с общественным мнением, но не обязательно играет доминирующую роль в отношении других. Нельзя считать, что люди ему не нравятся, он просто не нуждается в их согласии и поддержке.';
                            }
    
                        }
                        if (results[i].Factor == 'Q3') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Самоконтроль (Фактор Q3)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 6) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для слабовольных и обладающих плохим самоконтролем людей. Такие люди слабо способны придать своей энергии конструктивное направление и не расточать ее. Они не умеют организовывать свое время и порядок выполнения дел. Как правило, подобные люди не остаются долго на одной работе и в силу этого не достигают мастерства и не идентифицируют себя с профессиональной деятельностью.';
                            }
                            else if (results[i].Value >= 7 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о внутренней недисциплинированности, конфликтности (низкой интеграции).';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 13) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о контролируемости, социальной точности, следовании «Я»-образу (высокой интеграции).';
                            }
                            else if (results[i].Value >= 14 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Такие результаты свидетельствуют об организованности, умении хорошо контролировать свои эмоции и поведение. Подобные личности способны эффективно управлять своей энергией и умеют хорошо планировать свою жизнь. Они думают, прежде чем действовать, упорно преодолевают препятствия, не останавливаются при столкновении с трудными проблемами, склонны доводить начатое до конца и не дают обещания, которые не могут выполнить. Подобные люди хорошо осознают социальные требования и заботятся о своей общественной репутации.';
                            }
    
                        }
                        if (results[i].Factor == 'Q4') {
                            
                            processed_data[0].factors[i] = {
                                name: 'Напряженность (Фактор Q4)',
                                description: '',
                                clarification: ''
                            }
    
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 9) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для людей, которые отличаются расслабленностью, отсутствием сильных побуждений и желаний. Они невозмутимы, спокойно относятся к неудачам и удачам, находят удовлетворение в любом положении дел и не стремятся к достижениям и переменам.';
                            }
                            else if (results[i].Value >= 10 && results[i].Value <= 15) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о расслабленности (ненапряженности), нефрустрированности.';
                            }
                            else if (results[i].Value >= 16 && results[i].Value <= 20) {
                                processed_data[0].factors[i].description = 'Результаты свидетельствуют о напряженности, фрустрированности, побуждаемости, сверхреактивности (высоком энергетическом напряжении).';
                            }
                            else if (results[i].Value >= 21 && results[i].Value <= 26) {
                                processed_data[0].factors[i].description = 'Такие результаты характерны для человека, у которого выражен классический невроз тревожности. Подобные люди постоянно находятся в состоянии возбуждения, с большим трудом успокаиваются, чувствуют себя разбитыми, усталыми, и не могут оставаться без дела даже в обстановке, способствующей отдыху. Для таких людей характерны эмоциональная неустойчивость с преобладанием пониженного настроения, раздражительность, проблемы со сном, негативное отношение к критике.';
                            }
    
                        }
                    }
                    
                }
                else if (request.params.test_id == 21) {
    
                    // Обработка результатов ценностного опросника Шварца
                    
                    let schwartz_processing_params = {
                        first_test: [],
                        second_test: []
                    }
    
                    for (let i = 0; i < results.length; i++) {
                        
                        if (results[i].Factor == 'Безопасность (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Безопасность',
                                clarification: 'Безопасность — безопасность для других людей и себя, гармония, стабильность общества и взаимоотношений. Она производна от базовых индивидуальных и групповых потребностей. По мнению Ш. Шварца, существует один обобщенный тип ценности безопасность, связано это с тем, что ценности, относящиеся к коллективной безопасности, в значительной степени выражают цель безопасности и для личности (социальный порядок, безопасность семьи, национальная безопасность, взаимное расположение, взаимопомощь, чистота, чувство принадлежности, здоровье).',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Безопасность (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Безопасность',
                                clarification: 'Безопасность — безопасность для других людей и себя, гармония, стабильность общества и взаимоотношений. Она производна от базовых индивидуальных и групповых потребностей. По мнению Ш. Шварца, существует один обобщенный тип ценности безопасность, связано это с тем, что ценности, относящиеся к коллективной безопасности, в значительной степени выражают цель безопасности и для личности (социальный порядок, безопасность семьи, национальная безопасность, взаимное расположение, взаимопомощь, чистота, чувство принадлежности, здоровье).',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Власть (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Власть',
                                clarification: 'Власть — социальный статус, доминирование над людьми и ресурсами. Центральная цель этого типа ценностей заключается в достижении социального статуса или престижа, контроля или доминирования над людьми и средствами (авторитет, богатство, социальная власть, сохранение своего общественного имиджа, общественное признание). Ценности власти и достижения фокусируются на социальном уважении, однако ценности достижения (например, успешный, амбициозный) подчеркивают активное проявление компетентности в непосредственном взаимодействии, в то время как ценности власти (авторитет, богатство) подчеркивают достижение или сохранение доминантной позиции в рамках целой социальной системы.',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Власть (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Власть',
                                clarification: 'Власть — социальный статус, доминирование над людьми и ресурсами. Центральная цель этого типа ценностей заключается в достижении социального статуса или престижа, контроля или доминирования над людьми и средствами (авторитет, богатство, социальная власть, сохранение своего общественного имиджа, общественное признание). Ценности власти и достижения фокусируются на социальном уважении, однако ценности достижения (например, успешный, амбициозный) подчеркивают активное проявление компетентности в непосредственном взаимодействии, в то время как ценности власти (авторитет, богатство) подчеркивают достижение или сохранение доминантной позиции в рамках целой социальной системы.',
                                average_score: (results[i].Value / 5).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Гедонизм (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Гедонизм',
                                clarification: 'Гедонизм — наслаждение или чувственное удовольствие. Мотивационная цель данного типа определяется как наслаждение или чувственное удовольствие (удовольствия, наслаждение жизнью).',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Гедонизм (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Гедонизм',
                                clarification: 'Гедонизм — наслаждение или чувственное удовольствие. Мотивационная цель данного типа определяется как наслаждение или чувственное удовольствие (удовольствия, наслаждение жизнью).',
                                average_score: (results[i].Value / 5).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Доброта (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Доброта',
                                clarification: 'Доброта — сохранение и повышение благополучия близких людей. Это более узкий «просоциальный» тип ценностей по сравнению с универсализмом. Лежащая в ее основе доброжелательность сфокусирована на благополучии в повседневном взаимодействии с близкими людьми. Этот тип ценностей считается производным от потребности в позитивном взаимодействии, потребности в аффилиации и обеспечении процветания группы. Его мотивационная цель — сохранение благополучия людей, с которыми индивид находится в личных контактах (полезность, лояльность, снисходительность, честность, ответственность, дружба, зрелая любовь).',
                                average_score: (results[i].Value / 6).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Доброта (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Доброта',
                                clarification: 'Доброта — сохранение и повышение благополучия близких людей. Это более узкий «просоциальный» тип ценностей по сравнению с универсализмом. Лежащая в ее основе доброжелательность сфокусирована на благополучии в повседневном взаимодействии с близкими людьми. Этот тип ценностей считается производным от потребности в позитивном взаимодействии, потребности в аффилиации и обеспечении процветания группы. Его мотивационная цель — сохранение благополучия людей, с которыми индивид находится в личных контактах (полезность, лояльность, снисходительность, честность, ответственность, дружба, зрелая любовь).',
                                average_score: (results[i].Value / 8).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Достижение (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Достижение',
                                clarification: 'Достижение — личный успех через проявление компетентности в соответствии с социальными стандартами. Проявление социальной компетентности (что составляет содержание этой ценности) в условиях доминирующих культурных стандартов влечет за собой социальное одобрение.',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Достижение (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Достижение',
                                clarification: 'Достижение — личный успех через проявление компетентности в соответствии с социальными стандартами. Проявление социальной компетентности (что составляет содержание этой ценности) в условиях доминирующих культурных стандартов влечет за собой социальное одобрение.',
                                average_score: (results[i].Value / 5).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Конформность (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Конформность',
                                clarification: 'Конформность — сдерживание действий и побуждений, которые могут навредить другим и не соответствуют социальным ожиданиям. Данная ценность является производной от требования сдерживать склонности, имеющие негативные социальные последствия (послушание, самодисциплина, вежливость, уважение родителей и старших).',
                                average_score: (results[i].Value / 3).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Конформность (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Конформность',
                                clarification: 'Конформность — сдерживание действий и побуждений, которые могут навредить другим и не соответствуют социальным ожиданиям. Данная ценность является производной от требования сдерживать склонности, имеющие негативные социальные последствия (послушание, самодисциплина, вежливость, уважение родителей и старших).',
                                average_score: (results[i].Value / 3).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Самостоятельность (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Самостоятельность',
                                clarification: 'Самостоятельность — самостоятельность мысли и действия. Определяющая цель этого типа ценностей состоит в самостоятельности мышления и выбора способов действия, в творчестве и исследовательской активности. Самостоятельность как ценность производна от организменной потребности в самоконтроле и самоуправлении, а также от интеракционных потребностей в автономности и независимости.',
                                average_score: (results[i].Value / 3).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Самостоятельность (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Самостоятельность',
                                clarification: 'Самостоятельность — самостоятельность мысли и действия. Определяющая цель этого типа ценностей состоит в самостоятельности мышления и выбора способов действия, в творчестве и исследовательской активности. Самостоятельность как ценность производна от организменной потребности в самоконтроле и самоуправлении, а также от интеракционных потребностей в автономности и независимости.',
                                average_score: (results[i].Value / 3).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Стимуляция (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Стимуляция',
                                clarification: 'Стимуляция — стремление к новизне и волнению, глубоким переживаниям. Этот тип ценностей является производным от организменной потребности в разнообразии и глубоких переживаниях для поддержания оптимального уровня активности. Биологически обусловленные вариации потребности в стимуляции, опосредованные социальным опытом, приводят к индивидуальным различиям в значимости этой ценности.',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Стимуляция (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Стимуляция',
                                clarification: 'Стимуляция — стремление к новизне и волнению, глубоким переживаниям. Этот тип ценностей является производным от организменной потребности в разнообразии и глубоких переживаниях для поддержания оптимального уровня активности. Биологически обусловленные вариации потребности в стимуляции, опосредованные социальным опытом, приводят к индивидуальным различиям в значимости этой ценности.',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Традиция (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Традиция',
                                clarification: 'Традиция — уважение и ответственность за культурные и религиозные обычаи и идеи. Любые социальные группы вырабатывают свои символы и ритуалы. Их роль и функционирование определяются опытом группы и закрепляются в традициях и обычаях. Традиционный способ поведения становится символом групповой солидарности, выражением единых ценностей и гарантией выживания. Традиции чаще всего принимают формы религиозных обрядов, верований и норм поведения. Мотивационная цель данной ценности — уважение, принятие обычаев и идей, которые существуют в культуре (уважение традиций, смирение, благочестие, принятие своей участи, умеренность) и следование им.',
                                average_score: (results[i].Value / 3).toFixed(5),
                            });
                        }
                        else if (results[i].Factor == 'Традиция (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Традиция',
                                clarification: 'Традиция — уважение и ответственность за культурные и религиозные обычаи и идеи. Любые социальные группы вырабатывают свои символы и ритуалы. Их роль и функционирование определяются опытом группы и закрепляются в традициях и обычаях. Традиционный способ поведения становится символом групповой солидарности, выражением единых ценностей и гарантией выживания. Традиции чаще всего принимают формы религиозных обрядов, верований и норм поведения. Мотивационная цель данной ценности — уважение, принятие обычаев и идей, которые существуют в культуре (уважение традиций, смирение, благочестие, принятие своей участи, умеренность) и следование им.',
                                average_score: (results[i].Value / 4).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Универсализм (индивидуальный приоритет)') {
                            schwartz_processing_params.second_test.push({
                                name: 'Универсализм',
                                clarification: 'Универсализм — понимание, терпимость и защита благополучия всех людей и природы. Мотивационные цели универсализма производны от тех потребностей выживания групп и индивидов, которые становятся явно необходимыми при вступлении людей в контакт с кем-либо вне своей среды или при расширении первичной группы.',
                                average_score: (results[i].Value / 5).toFixed(5)
                            });
                        }
                        else if (results[i].Factor == 'Универсализм (нормативный идеал)') {
                            schwartz_processing_params.first_test.push({
                                name: 'Универсализм',
                                clarification: 'Универсализм — понимание, терпимость и защита благополучия всех людей и природы. Мотивационные цели универсализма производны от тех потребностей выживания групп и индивидов, которые становятся явно необходимыми при вступлении людей в контакт с кем-либо вне своей среды или при расширении первичной группы.',
                                average_score: (results[i].Value / 5).toFixed(5)
                            });
                        }
    
                    }
    
                    // Сортировка первого подтеста
                    schwartz_processing_params.first_test.sort((a, b) => a.average_score < b.average_score ? 1 : -1);
                    
                    // Сортировка второго подтеста
                    schwartz_processing_params.second_test.sort((a, b) => a.average_score < b.average_score ? 1 : -1);
    
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Уровень нормативных идеалов',
                        section_explanation: 'Отражает представления человека о том, как нужно поступать, определяя тем самым его жизненные принципы поведения. Человек считает, что так должно быть, так правильно.',
                        factors: []
                    }
                    for (let i = 0; i < 10; i++) {
                        processed_data[0].factors[i] = {
                            name: schwartz_processing_params.first_test[i].name,
                            description: `Приоритет №${i + 1}`,
                            clarification: schwartz_processing_params.first_test[i].clarification
                        }
                    }
    
                    processed_data[1] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Уровень индивидуальных приоритетов',
                        section_explanation: 'Соотносится с конкретными поступками человека. То, чем руководствуется человек в реальной жизни.',
                        factors: []
                    }
                    for (let i = 0; i < 10; i++) {
                        processed_data[1].factors[i] = {
                            name: schwartz_processing_params.second_test[i].name,
                            description: `Приоритет №${i + 1}`,
                            clarification: schwartz_processing_params.second_test[i].clarification
                        }
                    }
                    
                }
                else if (request.params.test_id == 31) {
    
                    // Обработка результатов Большой Пятёрки
    
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Психологическая модель личности, оценивающая пять независимых свойств нервной системы',
                        section_explanation: 'Авторы пятифакторного личностного опросника Р. МакКрае и П. Коста убеждены, что выделенных пяти независимых переменных, точнее личностных факторов темперамента и характера (нейротизм, экстраверсия, открытость опыту, сотрудничество, добросовестность) достаточно для объективного описания психологического портрета – модели личности.',
                        factors: []
                    }
    
                    for (let i = 0; i < 5; i++) {
                        if (results[i].Factor == 'Привязанность–обособленность') {
                            //
                            if (results[i].Value <= 45) {
                                processed_data[0].factors[i] = {
                                    name: 'Обособленность',
                                    description: 'Низкие оценки по фактору свидетельствует о стремлении человека быть независимым и самостоятельным. Такие люди предпочитают держать дистанцию, иметь обособленную позицию при взаимодействии с другими. Они избегают общественных поручений, небрежны в выполнении своих обязанностей и обещаний.', 
                                    clarification: 'Люди с выраженной обособленностью холодно относятся к другим людям, часто не понимают тех, с кем общаются. Их больше волнуют собственные проблемы, чем проблемы окружающих их людей. Свои интересы они ставят выше интересов других людей и всегда готовы их отстаивать в конкурентной борьбе. Такие люди обычно стремятся к совершенству. Для достижения своих целей они используют все доступные им средства, не считаясь с интересами других людей. Люди с такими характеристиками редко демократичным путем становятся руководителями.'
                                }
                            }
                            else {
                                processed_data[0].factors[i] = {
                                    name: 'Привязанность',
                                    description: 'Высокие значения по данному фактору определяют позитивное отношение человека к людям. Такие лица испытывают потребность быть рядом с другими людьми. Как правило, это добрые, отзывчивые люди, они хорошо понимают других людей, чувствуют личную ответственность за их благополучие, терпимо относятся к недостаткам других людей.', 
                                    clarification: 'Люди с высокой привязанностью умеют сопереживать, поддерживают коллективные мероприятия и чувствуют ответственность за общее дело, добросовестно и ответственно выполняют взятые на себя поручения. Взаимодействуя с другими, такие люди стараются избегать разногласий, не любят конкуренции, больше предпочитают сотрудничать с людьми, чем соперничать. В группе такие люди, как правило, пользуются уважением.'
                                }
                            }
                            //
                        }
                        else if (results[i].Factor == 'Самоконтроль–импульсивность') {
                            //
                            if (results[i].Value <= 45) {
                                processed_data[0].factors[i] = {
                                    name: 'Импульсивность (низкий самоконтроль поведения)',
                                    description: 'Человек, имеющий низкую оценку по этому фактору, редко проявляет в своей жизни волевые качества, он живет, стараясь не усложнять свою жизнь. Ищет «легкой жизни». Это такой тип личности, для которого характерны естественность поведения, беспечность, склонность к необдуманным поступкам.', 
                                    clarification: 'Импульсивный человек может недобросовестно относиться к работе, не проявляя настойчивости в достижении цели. Он не прилагает достаточных усилий для выполнения принятых в обществе требований и культурных норм поведения, может презрительно относиться к моральным ценностям. Человек, имеющий такую черту, склонен совершать асоциальные поступки. Ради собственной выгоды он способен на нечестность и обман. Такой человек, как правило, живет одним днем, не заглядывая в свое будущее.'
                                }
                            }
                            else {
                                processed_data[0].factors[i] = {
                                    name: 'Самоконтроль (высокий самоконтроль поведения)',
                                    description: 'Главным содержанием этого фактора является волевая регуляция поведения. На полюсе высоких значений находится такие черты личности, как добросовестность, ответственность, обязательность, точность и аккуратность в делах.', 
                                    clarification: 'Люди с высоким уровнем самоконтроля поведения любят порядок и комфорт, они настойчивы в деятельности и обычно достигают в ней высоких результатов. Они придерживаются моральных принципов, не нарушают общепринятых норм поведения в обществе и соблюдают их даже тогда, когда нормы и правила кажутся пустой формальностью. Высокая добросовестность и сознательность обычно сочетаются с хорошим самоконтролем, со стремлением к утверждению общечеловеческих ценностей, иногда в ущерб личным. Такие люди редко чувствуют себя полностью раскованными настолько, чтобы позволить себе дать волю чувствам.'
                                }
                            }
                            //
                        }
                        else if (results[i].Factor == 'Экспрессивность–практичность') {
                            //
                            if (results[i].Value <= 45) {
                                processed_data[0].factors[i] = {
                                    name: 'Практичность',
                                    description: 'Человек с выраженной чертой практичности по своему складу реалист, хорошо адаптирован в обыденной жизни. Он трезво и реалистично смотрит на жизнь, верит в материальные ценности больше, чем в отвлеченные идеи. Такой человек часто озабочен своими материальными проблемами, упорно работает и проявляет завидную настойчивость, воплощая в жизнь свои планы.', 
                                    clarification: 'Негибкий и неартистичный, часто простой и лишенный чувства юмора в обычной жизни, человек с выраженной практичностью проявляет постоянство своих привычек и интересов. Он не любит резких перемен в своей жизни, предпочитает постоянство и надежность во всем, что его окружает. Он несентиментален, поэтому его трудно вывести из равновесия, повлиять на сделанный выбор. Ко всем жизненным событиям такой человек подходит с логической меркой, ищет рациональных объяснений и практической выгоды.'
                                }
                            }
                            else {
                                processed_data[0].factors[i] = {
                                    name: 'Экспрессивность',
                                    description: 'Для человека с такой чертой характерно легкое отношение к жизни. Он производит впечатление беззаботного и безответственного, которому сложно понять тех, кто рассчитывает каждый свой шаг, отдает свои силы созданию материального благополучия. К жизни он относится как к игре, совершая поступки, за которыми окружающие видят проявление легкомыслия. Человек, имеющий высокие оценки по этому фактору, удовлетворяет свое любопытство, проявляя интерес к различным сторонам жизни.', 
                                    clarification: 'Человек с выраженной экспрессивностью легко обучается, но недостаточно серьезно относится к систематической научной деятельности, поэтому редко достигает больших успехов в науке. Часто не отличает вымысел от реальностей жизни. Он чаще доверяет своим чувствам и интуиции, чем здравому смыслу, мало обращает внимания на текущие повседневные дела и обязанности, избегает рутинной работы. Это эмоциональный, экспрессивный, с хорошо развитым эстетическим и художественным вкусом человек.'
                                }
                            }
                            //
                        }
                        else if (results[i].Factor == 'Экстраверсия–интроверсия') {
                            //
                            if (results[i].Value <= 45) {
                                processed_data[0].factors[i] = {
                                    name: 'Интроверсия',
                                    description: 'Низкие значения по фактору характерны для интровертов. Основными особенностями интровертов являются отсутствие уверенности в отношении правильности своего поведения и невнимание к происходящим вокруг событиям; большая опора на собственные силы и желания, чем на взгляды других людей; предпочтение абстрактных идей конкретным явлениям действительности.',
                                    clarification: 'Интроверты обладают ровным, несколько сниженным фоном настроения. Они озабочены своими личными проблемами и переживаниями. Такие люди обычно сдержанны, замкнуты, избегают рассказывать о себе, не интересуются проблемами других людей. Они предпочитают книги общению с людьми. Интроверты отдают предпочтение теоретическим и научным видам деятельности. В учебе они достигают более заметных успехов, чем экстраверты. Интровертированные люди любят планировать свое будущее, всегда взвешивают свои поступки, не доверяют первым побуждениям и увлечениям, всегда строго контролируют свои чувства, редко бывают несдержанными и возбужденными. Интроверты легче переносят однообразие в деятельности, лучше работают в спокойной обстановке и в первой половине дня. Они более чувствительны к наказанию, чем к поощрению.'
                                }
                            }
                            else {
                                processed_data[0].factors[i] = {
                                    name: 'Экстраверсия',
                                    description: 'Высокие значения по фактору определяют направленность психики человека на экстраверсию. Типичные экстраверты отличаются общительностью, любят развлечения и коллективные мероприятия, имеют большой круг друзей и знакомых, ощущают потребность общения с людьми, с которыми можно поговорить и приятно провести время, стремятся к праздности и развлечениям, не любят себя утруждать работой или учебой, тяготеют к острым, возбуждающим впечатлениям, часто рискуют, действуют импульсивно, необдуманно, по первому побуждению.',
                                    clarification: 'Экстраверты беззаботны, оптимистичны и любят перемены. У них ослаблен контроль над чувствами и поступками, поэтому они бывают склонны к вспыльчивости и агрессивности. В работе, как правило, ориентированы на скорость выполнения задания, от однообразной деятельности у них быстрее развивается состояние монотонии. Экстраверты предпочитают работать с людьми. В деятельности экстраверты быстрее, чем интроверты, извлекают информацию из памяти, лучше выполняют трудные задания в ситуации дефицита времени.'
                                }
                            }
                            //
                        }
                        else if (results[i].Factor == 'Эмоциональная_устойчивость–эмоциональная_неустойчивость') {
                            //
                            if (results[i].Value <= 45) {
                                processed_data[0].factors[i] = {
                                    name: 'Эмоциональная устойчивость',
                                    description: 'Низкие значения по этому фактору свойственны лицам самодостаточным, уверенным в своих силах, эмоционально зрелым, смело смотрящим в лицо фактам, спокойным, постоянным в своих планах и привязанностях, не поддающимся случайным колебаниям настроения. На жизнь такие люди смотрят серьезно и реалистично, хорошо осознают требования действительности, не скрывают от себя собственных недостатков, не расстраиваются из-за пустяков, чувствуют себя хорошо приспособленными к жизни.', 
                                    clarification: 'Эмоционально устойчивые люди сохраняют хладнокровие и спокойствие даже в самых неблагоприятных ситуациях. Они чаще пребывают в хорошем расположении духа, чем в плохом.'
                                }
                            }
                            else {
                                processed_data[0].factors[i] = {
                                    name: 'Эмоциональная неустойчивость',
                                    description: 'Высокие значения по этому фактору характеризуют лиц, неспособных контролировать свои эмоции и импульсивные влечения. В поведении это проявляется как отсутствие чувства ответственности, уклонение от реальности, капризность. Такие люди чувствуют себя беспомощными, неспособными справиться с жизненными трудностями. Их поведение во многом обусловлено ситуацией.', 
                                    clarification: 'Эмоционально неустойчивые люди с тревогой ожидают неприятностей, в случае неудачи легко впадают в отчаяние и депрессию. Они хуже работает в стрессовых ситуациях, в которых испытывают психологическое напряжение. У них, как правило, занижена самооценка, они обидчивы и в неудачах.'
                                }
                            }
                            //
                        }
                    }    
                }
                else if (request.params.test_id == 51) {

                    // Обработка результатов теста на Темперамент
                    
                    let temperament_criteria = {
                        extraversion: 0,
                        neurotism: 0
                    }
                
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Темперамент',
                        section_explanation: '',
                        factors: []
                    }
                
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].Factor == 'Экстраверсия') {
                
                            processed_data[0].factors[i] = {
                                name: 'Шкала экстраверсии-интроверсии',
                                description: '',
                                clarification: 'Экстравертам свойственна общительность, широкий круг знакомств, направленность деятельности вовне, постоянное движение. Экстраверты импульсивны и вспыльчивы, возможна агрессивность. Экстравертам свойственна беззаботность и оптимизм. Интроверты же спокойны и сдержанны, их переживания и энергия направлены вовнутрь. Интроверты несколько пессимистичны, ответственно подходят к делу и долго обдумывают решения. Отдалены от всех, кроме близких людей.'
                            }
                
                            temperament_criteria.extraversion = results[i].Value;
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 6) {
                                processed_data[0].factors[i].description = 'Низкие оценки по шкале экстраверсия-интроверсия соответствуют интровертированному типу.';
                            }
                            else if (results[i].Value >= 7 && results[i].Value <= 15) {
                                processed_data[0].factors[i].description = 'Средние показатели по шкале экстраверсия-интроверсия.';
                            }
                            else if (results[i].Value >= 16) {
                                processed_data[0].factors[i].description = 'Высокие оценки по шкале экстраверсия-интроверсия соответствуют экстравертированному типу.';
                            }
                
                        }
                        if (results[i].Factor == 'Нейротизм') {
                
                            processed_data[0].factors[i] = {
                                name: 'Шкала нейротизма',
                                description: '',
                                clarification: 'Данная шкала характеризуют эмоциональную устойчивость или неустойчивость (стабильность или нестабильность). Эмоциональная стабильность характеризуется зрелостью, способностью к адаптации, отсутствием большого беспокойства и умением сохранить организованность в стрессовой ситуации. Эмоциональная нестабильность выражается в чрезвычайном беспокойстве, неспособности адаптироваться, импульсивности, быстрой смене настроения; характеризуется сложностью в общении с людьми и неустойчивым поведением в стрессовых условиях.'
                            }
                
                            temperament_criteria.neurotism = results[i].Value;
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Низкие баллы по шкале нейротизма свидетельствуют об эмоциональной стабильности человека.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 16) {
                                processed_data[0].factors[i].description = 'Средние показатели по шкале нейротизма.';
                            }
                            else if (results[i].Value >= 17) {
                                processed_data[0].factors[i].description = 'Высокие баллы по шкале нейротизма свидетельствуют об эмоциональной нестабильности человека (нейротизме).';
                            }
                
                        }
                        if (results[i].Factor == 'Психотизм') {
                
                            processed_data[0].factors[i] = {
                                name: 'Шкала психотизма',
                                description: '',
                                clarification: 'Данная шкала говорит о склонности человека к конфликтам, эгоистичности, равнодушию, асоциальному поведению. Высокие баллы говорят о неадекватности эмоциональных реакций, сложности в построении межличностных отношений и неспособности контактировать с другими людьми.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 4) {
                                processed_data[0].factors[i].description = 'Низкие значения по шкале психотизма.';
                            }
                            else if (results[i].Value >= 5 && results[i].Value <= 10) {
                                processed_data[0].factors[i].description = 'Средние значения по шкале психотизма.';
                            }
                            else if (results[i].Value >= 11 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средние значения по шкале психотизма, не рекомендуется работать по специальности типа "человек-человек".';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Высокие значения по шкале психотизма, не рекомендуется работать по специальности типа "человек-человек".';
                            }
                
                        }
                        if (results[i].Factor == 'Искренность') {
                
                            processed_data[0].factors[i] = {
                                name: 'Шкала искренности',
                                description: '',
                                clarification: 'Эта шкала определяет достоверность результатов тестирования.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 10) {
                                processed_data[0].factors[i].description = 'Результаты тестирования недостоверны, рекомендуется отвечать на вопросы более откровенно.';
                            }
                            else if (results[i].Value >= 0 && results[i].Value <= 9) {
                                processed_data[0].factors[i].description = 'Высокий уровень искренности во время тестирования.';
                            }
                        }
                    }
                    
                    if (temperament_criteria.extraversion >= 13 && temperament_criteria.neurotism >= 13) {
                        processed_data[0].section_explanation = 'Ваш тип темперамента - Холерик. Это активный тип темперамента с неустойчивой нервной системой. Холерикам свойственны частые смены настроения, склонность к лидерству и стремление успеть везде, приобрести новые знания и умения. Люди с данным типом темперамента очень общительны, открыты и прямолинейны; часто бывают вспыльчивы и нетерпеливы, склонны считать, что они знают и могут лучше других. Холериков отличает ответственный подход к делу, настойчивость и оптимизм.';
                    }
                    else if (temperament_criteria.extraversion >= 13 && temperament_criteria.neurotism <= 12) {
                        processed_data[0].section_explanation = 'Ваш тип темперамента - Сангвиник. Сангвиники жизнерадостны, общительны, склонны к лидерству, обладают устойчивой нервной системой. Им легко адаптироваться в новой обстановке и оказаться в центре внимания любой компании благодаря их чувству юмора и коммуникабельности. Часто сангвиники бывают поверхностны, зациклены на себе и непостоянны; также возможна некоторая хаотичность действий. Тем не менее, представители данного темперамента обладают высокой работоспособностью и нравятся другим людям.';
                    }
                    else if (temperament_criteria.extraversion <= 12 && temperament_criteria.neurotism <= 12) {
                        processed_data[0].section_explanation = 'Ваш тип темперамента - Флегматик. Представители этого темперамента сдержанны, сохраняют невозмутимость в любой ситуации. Им свойственно долго обдумывать своё решение и не свойственно проявлять эмоции, они сдержанны и неразговорчивы. Флегматикам тяжело адаптироваться в новых условиях и устанавливать социальные контакты. Людей данного темперамента отличает высокая самоорганизация и работоспособность, стрессоустойчивость и эмоциональная стабильность.';
                    }
                    else if (temperament_criteria.extraversion <= 12 && temperament_criteria.neurotism >= 13) {
                        processed_data[0].section_explanation = 'Ваш тип темперамента - Меланхолик. Меланхолик – пассивный тип темперамента с высокой эмоциональностью. Представителям этого типы свойственны медленный ритм жизни и глубокие переживания касаемо любых событий. Меланхолики способны анализировать и не совершают импульсивных действий, они преданны своим близким и отличаются постоянством, эмпатичны. В то же время они ранимы, остро реагируют на критику, испытывают сложности в коммуникации. Представители этого типа часто находят себя в творческих профессиях.';
                    }
                }
                else if (request.params.test_id == 61) {

                    // Обработка результатов теста "Характерологический опросник Леонгарда"
                
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Характерологический опросник Леонгарда',
                        section_explanation: 'Акцентуацией личности называется чрезмерность проявления некоторых черт характера или их сочетаний. Тест К. Леонгарда позволяет выявить и предвидеть проявление скрытых акцентуаций в поведении человека под воздействием некоторых факторов.',
                        factors: []
                    }
                
                    for (let i = 0; i < results.length; i++) {
                        if (results[i].Factor == 'Г-1') {
                
                            processed_data[0].factors[i] = {
                                name: 'Гипертимные',
                                description: '',
                                clarification: 'Гипертимному типу свойственен повышенный фон настроения в сочетании с постоянной необходимостью деятельности, высокой степенью активности, предприимчивостью. Представители этого психотипа оптимистичны, отзывчивы, любят быть в центре внимания, мало что способно испортить их настроение.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-2') {
                
                            processed_data[0].factors[i] = {
                                name: 'Застревающие',
                                description: '',
                                clarification: 'Этот тип акцентуации личности характеризуется тем, что у них сравнительно надолго задерживаются аффекты (кратковременные сильные эмоциональные переживания). Представители данного типа "застревают" на мыслях и чувствах, особенно касающихся их собственного чувства достоинства.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-3') {
                
                            processed_data[0].factors[i] = {
                                name: 'Эмотивные',
                                description: '',
                                clarification: 'Этот тип характеризует чувствительность, впечатлительность и глубокие переживания. Люди с этим типом характера очень восприимчивы ко всем удачам и неудачам, они чуткие и являются хорошими слушателями, предпочитают копить чувства в себе.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-4') {
                
                            processed_data[0].factors[i] = {
                                name: 'Педантичные',
                                description: '',
                                clarification: 'Для педантичного типа свойственны трудности в приспособлении к новому, низкая подвижность нервной системы, долгое переживание травмирующих событий. Люди этого типа отличаются серьёзным подходом ко всем вопросам, медленным принятием решений, усидчивостью. Они пунктуальны, неконфликтны, добросовестны.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-5') {
                
                            processed_data[0].factors[i] = {
                                name: 'Тревожные',
                                description: '',
                                clarification: 'Тревожный тип отличает высокий уровень тревожности, повышенная робость и пугливость. Для представителей тревожного типа характерны сомнения в правильности своих мыслей и действий, долгие переживания неудач, нерешительность. Как правило, представители тревожного типа исполнительны, ответственны, доброжелательны.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-6') {
                
                            processed_data[0].factors[i] = {
                                name: 'Циклотимные',
                                description: '',
                                clarification: 'Циклотимному типу присуща периодическая смена настроения и активности. Радостное событие пробуждает у них жажду деятельности, рождает яркие эмоции, порождает словоохотливость. Что-то печальное приводит к грусти и подавленности, к замедлению реакции и заторможенности, к вялости и безынициативности.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-7') {
                
                            processed_data[0].factors[i] = {
                                name: 'Демонстративные',
                                description: '',
                                clarification: 'Данный тип характеризует демонстративное, театральное поведение, эгоцентризм, жажда постоянного внимания к себе. Представители демонстративного типа нарочито артистичны, склонны к фантазёрству и притворству, стремятся быть на виду, жаждут внимания и похвалы в свой адрес.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-8') {
                
                            processed_data[0].factors[i] = {
                                name: 'Неуравновешенные',
                                description: '',
                                clarification: 'Неуравновешенный тип отличают такие черты, как слабоволие, непоседливость, склонность к развлечениям, безынициативность. Представителям типа свойственна повышенная импульсивность, нехватка контроля над влечениями и побуждениями. Раздражитель¬ны, постоянно избегают трудностей, часто впадают в гнев и ярость.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-9') {
                
                            processed_data[0].factors[i] = {
                                name: 'Дистимные',
                                description: '',
                                clarification: 'Отличаются сниженным фоном настроения, фиксацией на мрачных сторонах жизни, идеомоторной заторможенностью. Представители дистимного типа испытывают ярко выраженную потребность в сочувствии и понимании со стороны других людей, склонны к чувству вины, но также они серьёзны, надёжны, охотно отзываются на просьбы о помощи.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                
                        }
                        else if (results[i].Factor == 'Г-10') {
                
                            processed_data[0].factors[i] = {
                                name: 'Экзальтированные',
                                description: '',
                                clarification: 'Экзальтированному типу свойственен большой диапазон эмоциональных состояний, склонность легко приходить в восторг от одних событий и в полное отчаяние от других. Этому типу свойственна частая смена настроений, яркое и искреннее выражение чувств, умение искренне радоваться чужим успехам, а также яркое сопереживание чужому горю. Среди людей этого типа много представителей творческих профессий.'
                            }
                
                            // Обработчик фактора
                            if (results[i].Value >= 0 && results[i].Value <= 7) {
                                processed_data[0].factors[i].description = 'Отсутствует выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 8 && results[i].Value <= 12) {
                                processed_data[0].factors[i].description = 'Средняя выраженность данной акцентуации.';
                            }
                            else if (results[i].Value >= 13) {
                                processed_data[0].factors[i].description = 'Сильная выраженность данной акцентуации.';
                            }
                            
                        }
                    }
                }
                else {
                    
                    // Обработчик по умолчанию
    
                    results.sort((a, b) => a.Question_ID < b.Question_ID ? 1 : -1);
    
                    processed_data[0] = {
                        reply_date: results[0].Reply_Date,
                        section_title: 'Благодарим за прохождение данного теста!',
                        section_explanation: 'Вы также можете пройти любой другой психологический тест, имеющийся в приложении😉',
                        factors: []
                    }
    
                }
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (get-proccessed-results)");
                });
    
                // Отправка на клиент обработанных результатов
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: processed_data }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});

// Отправка списка тестов на фронтенд
app.get("/test-list", function(request, response){
    
    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {

        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        const sql_zero = `SELECT * FROM Test;`;
           
        connection.query(sql_zero, function(error, results) {
            if (error) {
                console.log(error);
            }
            else {
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (test-list)");
                });
    
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: results }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});

// Отправка количества вопросов (общее и отвеченных) на фронтенд
app.get("/test-percent", function(request, response){
    
    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        
        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        const sql_zero = `SELECT COUNT(Q.Question_ID) AS Question_Count, Q.Test_ID AS Test_ID, (COUNT(PA_TWO.HZ_PA) + COUNT(PMA.HZ_PMA)) AS Question_Done_Count  
                            FROM Question AS Q 
                                LEFT JOIN (SELECT Q.Question_ID AS Question_ID, 1 AS HZ_PA FROM Person_Answer AS PA, Answer AS A, Question AS Q 
                                            WHERE PA.Answer_ID = A.Answer_ID AND A.Question_ID = Q.Question_ID 
                                                AND PA.Result_ID = 0 AND PA.VK_ID = ${accessStatus.vk_user_id}) AS PA_TWO
                                    ON PA_TWO.Question_ID = Q.Question_ID
                                LEFT JOIN (SELECT Question_ID, 1 AS HZ_PMA FROM Person_MultiAnswer 
                                            WHERE Status = 0 AND VK_ID = ${accessStatus.vk_user_id} GROUP BY Question_ID) AS PMA
                                    ON PMA.Question_ID = Q.Question_ID
                                GROUP BY Q.Test_ID
                                ORDER BY Q.Test_ID;`; 
           
        connection.query(sql_zero, function(error, results) {
            if (error)
                console.log(error);
            else {
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (test-percent)");
                })
    
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: results }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});

// Отправка коллекции вопросов и ответов на фронтенд
app.get("/test-information/:test_id", function(request, response){
    
    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        // Access allowed
        const connection = mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            database: DB_NAME,
            password: DB_PASSWORD
        });
    
        const sql_zero = `SELECT * FROM
                            (SELECT A.Answer_ID, A.Question_ID, A.description AS Answer_Description, 
                                A.Value, Q.Test_ID, Q.Description AS Question_Description,
                                Q.Category, PA.Answer_ID AS Prev_Answer, Q.Type AS Type, Q.A_Mode AS Mode, Q.Photo AS Photo 
                                    FROM Answer AS A
                                        INNER JOIN (SELECT * FROM Question WHERE A_Mode = 'single') AS Q ON A.Question_ID = Q.Question_ID
                                        LEFT JOIN (SELECT * FROM Person_Answer WHERE VK_ID = ${accessStatus.vk_user_id} AND Result_ID = 0) AS PA ON PA.Answer_ID = A.Answer_ID
                                            WHERE Q.Test_ID = ${request.params.test_id}
                            UNION
                            SELECT A.Answer_ID, A.Question_ID, A.description AS Answer_Description, 
                                A.Value, Q.Test_ID, Q.Description AS Question_Description,
                                Q.Category, NULL AS Prev_Answer, Q.Type AS Type, Q.A_Mode AS Mode, Q.Photo AS Photo 
                                    FROM Answer AS A
                                        INNER JOIN (SELECT * FROM Question WHERE A_Mode = 'multiple') AS Q ON A.Question_ID = Q.Question_ID
                                            WHERE Q.Test_ID = ${request.params.test_id}
                            UNION
                            SELECT NULL AS Answer_ID, Q.Question_ID AS Question_ID, NULL AS Answer_Description, 
                                NULL AS Value, Q.Test_ID AS Test_ID, Q.Description AS Question_Description,
                                NULL AS Category, PMA.Answer AS Prev_Answer, Q.Type AS Type, Q.A_Mode AS Mode, Q.Photo AS Photo
                                    FROM Question AS Q, Person_MultiAnswer AS PMA
                                            WHERE Q.Question_ID = PMA.Question_ID AND Q.A_Mode = 'multiple' 
                                                AND PMA.Status = 0 AND PMA.VK_ID = ${accessStatus.vk_user_id} AND Q.Test_ID = ${request.params.test_id}) AS KKJ
                                                ORDER BY ISNULL(Answer_ID);`;
            
        connection.query(sql_zero, function(error, results) {
            if (error)
                console.log(error);
            else {
               
                let data = [];
    
                for (let i = 0; i < results.length; i++) {
    
                    if (results[i].Answer_ID !== null) {
    
                        let is_exist = 0;
                        for (let j = 0; j < data.length; j++) {
                            if (results[i].Question_ID === data[j].Question_ID) {
                                data[j].Answers.push({
                                    Answer_ID: results[i].Answer_ID,
                                    Description: results[i].Answer_Description,
                                    Value: results[i].Value
                                });
                                data[j].isDone = (results[i].Prev_Answer !== null) ? 1 : data[j].isDone;
    
                                if (results[i].Prev_Answer !== null) {
                                    if (results[i].Mode === 'multiple') {
                                        data[j].Prev_Answers.push(results[i].Prev_Answer);
                                    }
                                    else if (results[i].Mode === 'single') {
                                        data[j].Prev_Answers.push(results[i].Answer_Description);
                                    }
                                }
    
                                is_exist = 1;
                            }
                        }
                        if (is_exist === 0) {
                            data.push({
                                Question_ID: results[i].Question_ID,
                                Test_ID: results[i].Test_ID,
                                Question_Description: results[i].Question_Description,
                                Photo: results[i].Photo != null ? results[i].Photo : '',
                                Category: results[i].Category,
                                Type: results[i].Type,
                                Mode: results[i].Mode,
                                Answers: [{
                                    Answer_ID: results[i].Answer_ID,
                                    Description: results[i].Answer_Description,
                                    Value: results[i].Value
                                }],
                                Prev_Answers: [],
                                isDone : (results[i].Prev_Answer !== null) ? 1 : 0
                            });
                            if (results[i].Prev_Answer !== null) {
                                if (results[i].Mode === 'multiple') {
                                    data[data.length - 1].Prev_Answers.push(results[i].Prev_Answer);
                                }
                                else if (results[i].Mode === 'single') {
                                    data[data.length - 1].Prev_Answers.push(results[i].Answer_Description);
                                }
                            }
                        }
                    }
                    else {
    
                        let ind = data.findIndex(item => item.Question_ID === results[i].Question_ID);
    
                        if (ind !== -1) {
                            data[ind].Prev_Answers.push(results[i].Prev_Answer);
                            data[ind].isDone = 1;
                        }
    
                    }
    
                }
    
                connection.end(function(error) {
                    if (error) {
                        return console.log("Ошибка: " + error.message);
                    }
                    console.log("Подключение закрыто (test-information)");
                });
                    
                response.setHeader('Content-Type', 'application/json');
                response.send(JSON.stringify({ results: data }));
            }
        });
    }
    else {
        // Access denied
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify({ error: 'access denied' }));
    }
});


//обслуживание html
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// Получение пользовательского ответа на вопрос из теста
app.post("/person-answer", jsonParser, function (request, response) {
    
    const accessStatus = encoder(request.header('Autorization'));

    if (accessStatus.status) {
        // Access allowed
        console.log(request.body);
        if (!request.body) { 
            return response.sendStatus(400);
        }

        if (request.body.question_mode == 'multiple') {
            
            // Запись в БД ответов на вопрос, где варианты ответа представлены чекбоксами
            let person_answers = request.body.person_answers;
            let vk_id = accessStatus.vk_user_id;
            let question_id = request.body.question_id

            let date = new Date();
            let datetime = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

            const connection = mysql.createConnection({
                host: DB_HOST,
                user: DB_USER,
                database: DB_NAME,
                password: DB_PASSWORD,
                connectionLimit: 1000
            });

            let person_data = [];
            let sql_add = "INSERT INTO person_multianswer(VK_ID, Answer, Question_ID, Reply_Date, Status) VALUES ";

            // 1. Обновление статуса ответов с "временных" на "лишние"
            connection.promise().query(`UPDATE Person_MultiAnswer SET Status = 2 WHERE VK_ID = ${vk_id} AND Question_ID = ${question_id} AND Status = 0;`)
            // 2. Добавление ответов пользователя в таблицу Person_MultiAnswer    
                .then(() => { 
                    for (let i = 0; i < person_answers.length; i++) {
                        if (i != (person_answers.length - 1)) {
                            sql_add += "(?, ?, ?, ?, DEFAULT), ";
                        }
                        else {
                            sql_add += "(?, ?, ?, ?, DEFAULT);"
                        }
                        person_data.push(vk_id, person_answers[i], question_id, datetime);
            
                        console.log(person_data)
                    }

                    connection.query(sql_add, person_data, function(error, results) {
                        if (error) {
                            console.log(error);
                        }
                    });
                })
            // 3. Закрытие подключения
                .then(() => {
                    connection.end(function(error) {
                        if (error) {
                            return console.log("Ошибка: " + error.message);
                        }
                        console.log("Подключение закрыто (скрипт add to person_multianswer)");
                    });
                })
            // 4. Отправка ответа от сервера
                .then(() => {
                    response.end('It worked!');
                })
                .catch(function(error) {
                    console.log(error.message);
                });
        }
        else if (request.body.question_mode == 'single') {

            // Запись в БД ответа на вопрос, где варианты ответа представлены кнопками
            let person_answer = request.body["person_answer"];
            let vk_id = accessStatus.vk_user_id;
            let question_id = request.body.question_id;

            let date = new Date();
            let datetime = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();

            const connection = mysql.createConnection({
                host: DB_HOST,
                user: DB_USER,
                database: DB_NAME,
                password: DB_PASSWORD,
                connectionLimit: 1000
            });
            
            const sql_upd = `UPDATE Person_Answer SET Result_ID = 2 
                                WHERE Person_Answer_ID = (SELECT * FROM (SELECT PA.Person_Answer_ID
                                    FROM Person_Answer AS PA, Answer AS A, Question AS Q
                                        WHERE PA.Answer_ID = A.Answer_ID AND A.Question_ID = Q.Question_ID 
                                            AND PA.VK_ID = ${vk_id} AND Result_ID = 0 AND Q.Question_ID = ${question_id}) AS NKD);`;

            const sql_add = "INSERT INTO person_answer(VK_ID, Answer_ID, Reply_Date) VALUES (?, ?, ?);";

            const person_data = [vk_id, person_answer, datetime];
            console.log(person_data);
            
            // 1. Обновление статуса предыдущих ответов с "временных" на "лишние"
            connection.promise().query(sql_upd)
            // 2. Добавление ответа пользователя в таблицу Person_Answer
                .then(() => { 
                    connection.query(sql_add, person_data, function(error, results) {
                        if (error) {
                            console.log(error);
                        }
                    });
                })
            // 3. Закрытие подключения
                .then(() => {
                    connection.end(function(error) {
                        if (error) {
                            return console.log("Ошибка: " + error.message);
                        }
                        console.log("Подключение закрыто (скрипт add to person_answer)");
                    });
                })
            // 4. Отправка ответа от сервера
                .then(() => {
                    response.end('It worked!');
                })
                .catch(function(error) {
                    console.log(error.message);
                });
        }
    }
    else {
        // Access denied
        response.end('Access denied');
    }
});

app.listen(port);
