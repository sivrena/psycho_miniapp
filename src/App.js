import { 
	Panel, PanelHeader, Group, Cell, List, 
	PanelHeaderBack, Button, FixedLayout, 
	ActionSheet, ScreenSpinner, CellButton, 
	Alert, Div, Separator, Banner, SimpleCell, 
	Header, InfoRow, Progress, PanelHeaderContent,
	ModalRoot, ModalPage, ModalPageHeader, 
	ModalRootContext, ModalCard, PanelHeaderClose, 
	PanelHeaderSubmit, Checkbox, FormLayout, Input
} 
from '@vkontakte/vkui';

import one_tap from './images/one_tap.png';

import React from 'react';
import bridge from '@vkontakte/vk-bridge';
import View from '@vkontakte/vkui/dist/components/View/View';

import '@vkontakte/vkui/dist/vkui.css';


export class Instruction extends React.Component {
	render() {
	  const someHtml = this.props.text;
	   
	  return (
		<div className="Container" dangerouslySetInnerHTML={{__html: someHtml}}></div>
	  )
	}
}

class App extends React.Component {
	constructor(props) {
	  super(props);
  
	  this.state = {
		
		// Пользовательские параметры
		user_id: 1, 		// VK ID пользователя

		// Информация о тесте/тестах
		testList: [],			// Список всех доступных тестов
		testInformation: [],	// Информация о выбранном тесте
		testResult: [],			// Результаты последнего прохождения выбранного теста
		testInstruction: '',	// Инструкция к выбранному тесту
		currentTestLable: '',	// Название текущего теста

		// Функциональные параметры 
		activePanel: 'panel0',	// Активная панель
		popout: null,			// Активный popout-элемент
		activeModal: null,		// Активная модальная страница
		countquest: 0,			// Номер текущего вопроса
		
		lastQuestionIsAnswered: 0,

		// Параметры для различных типов ответа
		selectedAnswers: [],	// Выбранные ответы (массив чекбоксов/друзей)
		inputLabels: [],		// Введённые ответы

	}

	  // Инициализация пользователя
	  this.userDBAuth = this.userDBAuth.bind(this);			// "Авторизация" пользовательского id в БД 

	  // Функции, что-то получающие с помощью VK Bridge
	  this.getUserId = this.getUserId.bind(this); 			// Получение идентификатора пользователя (user_id)
	  
	  // Функции, что-то получающиe с помощью GET-запроса с сервера
	  this.getTestList = this.getTestList.bind(this); 				// Получение коллекции всех тестов
	  this.getDonePercent = this.getDonePercent.bind(this); 		// Получение процентов отвеченных вопросов
	  this.getInformation = this.getInformation.bind(this); 		// Получение коллекции с информацией о выбранном тесте
	  this.getTestResult = this.getTestResult.bind(this); 			// Получение итоговых результатов по выбранному тесту

	  // Функции, что-то отправляющие с помощью POST-запроса на сервер
	  this.postPersonAnswer = this.postPersonAnswer.bind(this); // Отправка ответа пользователя на текущий вопрос на сервер

	  // Функции-обработчики
	  this.doResultUpdateAnswers = this.doResultUpdateAnswers.bind(this); 	// Формирование результата и смена статуса у ответов
	  this.convertTestInstruction = this.convertTestInstruction.bind(this); // Конвертирование строки с инструкцией

	  // Функции клиента
	  // (логика теста) 
	  this.nextQuestion = this.nextQuestion.bind(this);			// Переход к следующему вопросу теста или к результатам через кнопку
	  this.testActive = this.testActive.bind(this);				// Начало/продолжение тестирования из меню теста
	  this.toNecessaryPanel = this.toNecessaryPanel.bind(this); // Переход в меню выбранного теста
	  this.testAccess = this.testAccess.bind(this);				// Присвоение countquest номера первого неотвеченного вопроса
	  // (доп. элементы)
	  this.testExit = this.testExit.bind(this);								  // Вызов popout-элемента для выхода в меню теста
	  this.closePopout = this.closePopout.bind(this);						  // Закрытие popout-элемента
	  this.showFactorClarification = this.showFactorClarification.bind(this); // Вызов popout-элемента с описанием выбранного фактора
	  this.setActiveModal = this.setActiveModal.bind(this); 				  // Открытие/закрытие модального окна с инструкцией
	  this.testPassingError = this.testPassingError.bind(this);				  // Вызов popout-элемента при несоблюдении какого-то из условий тестирования
	  // (кнопки вперёд-назад)
	  this.goForward = this.goForward.bind(this);	// Вперёд по тесту
	  this.goBack = this.goBack.bind(this);			// Назад по тесту

	  // Функционал различных типов ответа на вопрос
	  this.chooseBox = this.chooseBox.bind(this);					// Чекбоксы с выбором множества вариантов
	  this.inputHandleSubmit = this.inputHandleSubmit.bind(this);	// Ввод значения из инпута
	  this.inputHandleChange = this.inputHandleChange.bind(this);	// Динамическое изменение значения в инпуте
	  this.chooseFriends = this.chooseFriends.bind(this);			// Выбор из списка друзей
	  this.buttonForMulti = this.buttonForMulti.bind(this);
	}

	// Инициализация клиента

	componentDidMount () {
		this.getUserId();
		this.getTestList();
	}

	userDBAuth () {
		let xhr = new XMLHttpRequest();

		// Блокировка интерфейса до подгрузки данных с сервера
		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				this.setState({ popout: <ScreenSpinner /> });
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				this.closePopout();
			}
		});

		xhr.open('GET', `user-db-auth?user_id=${this.state.user_id}`, true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else {
				// Получение токена пользователя (как одно из возможных действий)
			}
		};
	}


	// Функции, что-то получающие с помощью VK Bridge

	getUserId () {
		bridge
  			.send("VKWebAppGetUserInfo")
  			.then(data => {
				this.setState({ user_id: data.id });
				this.userDBAuth();
  			})
  			.catch(error => {
    			// Обработка события в случае ошибки
			});
	}


	// Функции, что-то получающиe с помощью GET-запроса с сервера

	getTestList () {
		let xhr = new XMLHttpRequest();
		xhr.open('GET', 'test-list', true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else { // если всё прошло гладко, выводим результат
				//console.log(xhr.response.results); // response -- это ответ сервера
				
				let inf_length = 0;
			  	for (let i = 0; i < xhr.response.results.length; i++) {
					this.state.testList[inf_length] =  xhr.response.results[i];
					inf_length++;
					//this.setState({});
			  	}
			  	this.setState({});
				
				// Узнаём проценты отвеченных вопросов
				this.getDonePercent();
			}
		};

		//console.log(this.state.testList);
	}

	getDonePercent () {
		let xhr = new XMLHttpRequest();

		// Блокировка интерфейса до подгрузки данных с сервера
		/* 
		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.setState({ popout: <ScreenSpinner /> });
    			//setTimeout(() => { this.setState({ popout: null }) }, 15000);
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.closePopout();
			}
		});
		*/

		xhr.open('GET', `test-percent?user_id=${this.state.user_id}`, true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else {
				for (let i = 0; i < this.state.testList.length; i++) {
					for (let j = 0; j < xhr.response.results.length; j++) {
						if (this.state.testList[i].Test_ID === xhr.response.results[j].Test_ID) {
							this.state.testList[i].Question_Count = xhr.response.results[j].Question_Count;
							this.state.testList[i].Question_Done_Count = Number(xhr.response.results[j].Question_Done_Count);
							this.setState({});
						}
					}
					//this.setState({});
				}
			}
		};

		// Вывод в консоль списка тестов
		//console.log(this.state.testList);
	}

	getInformation (test_id) {
		if (this.state.testInformation.length !== 0) {
			this.state.testInformation = [];
			this.setState({});
		}

		let xhr = new XMLHttpRequest();

		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.setState({ popout: <ScreenSpinner /> });
    			//setTimeout(() => { this.setState({ popout: null }) }, 15000);
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.closePopout();
			}
		});

		xhr.open('GET', `test-information/${test_id}?user_id=${this.state.user_id}`, true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else { // если всё прошло гладко, выводим результат
				//console.log(xhr.response.results); // response -- это ответ сервера
				
				let inf_length = 0;
			  	for (let i = 0; i < xhr.response.results.length; i++) {
					this.state.testInformation[inf_length] =  xhr.response.results[i];
					inf_length++;
					//this.setState({});
			  	}
				this.setState({});
			}
		};

		// Вывод в консоль информации о тесте
		//console.log(this.state.testInformation);
	}

	getTestResult (test_id) {

		// Получение результатов тестирования (get-result/:test_id?user_id=...)
		if (this.state.testResult.length !== 0) {
			this.state.testResult = [];
			this.setState({});
		}

		let xhr = new XMLHttpRequest();

		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.setState({ popout: <ScreenSpinner /> });
    			//setTimeout(() => { this.setState({ popout: null }) }, 15000);
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				//console.log(` Status = ${xhr.status}, State = ${xhr.readyState}`);
				this.closePopout();
			}
		});

		xhr.open('GET', `get-processed-result/${test_id}?user_id=${this.state.user_id}`, true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else { // если всё прошло гладко, выводим результат
				//console.log(xhr.response.results); // response -- это ответ сервера
				
				let inf_length = 0;
			  	for (let i = 0; i < xhr.response.results.length; i++) {
					this.state.testResult[inf_length] =  xhr.response.results[i];
					inf_length++;
					this.setState({});
			  	}
			  	//this.setState({});
			}
		};

		// Вывод в консоль результатов тестирования
		//console.log(this.state.testResult);
	}
	
	
	// Функции, что-то отправляющие с помощью POST-запроса на сервер

	postPersonAnswer (index, question_count) {

		let data = JSON.stringify({});
		if (this.state.testInformation[question_count].Mode == 'single') {
			data = JSON.stringify({
										person_answer: this.state.testInformation[question_count].Answers[index].Answer_ID, 
										id: this.state.user_id,
										question_type: this.state.testInformation[question_count].Type,
										question_mode: this.state.testInformation[question_count].Mode,
										question_id: this.state.testInformation[question_count].Question_ID
									});
		}
		else if (this.state.testInformation[question_count].Mode == 'multiple') {
			data = JSON.stringify({
										person_answers: this.state.selectedAnswers,
										id: this.state.user_id,
										question_type: this.state.testInformation[question_count].Type,
										question_id: this.state.testInformation[question_count].Question_ID,
										question_mode: this.state.testInformation[question_count].Mode
									});
		}

        let xhr = new XMLHttpRequest();

		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				this.setState({ popout: <ScreenSpinner /> });
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				this.closePopout();
			}
		});

		xhr.onloadend = () => {
			if (xhr.status == 200) {
			  
				if ((question_count + 1) >= this.state.testInformation.length) {
					this.doResultUpdateAnswers(this.state.testInformation[0].Test_ID);
				
				}
			} 
			else {
			  console.log("Ошибка " + this.status);
			}
		};

		// Посылаем запрос с данными на адрес "/person-answer"
        xhr.open("POST", "/person-answer", true);

		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//

        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(data);
	}


	// Функции-обработчики

	doResultUpdateAnswers (test_id) {
		
		// GET-запрос на /do-results-update-answers/:test_id?user_id=...
		let xhr = new XMLHttpRequest();

		xhr.addEventListener('readystatechange', () => {
			
			if (xhr.readyState !== 4) {
				this.setState({ popout: <ScreenSpinner /> });
			}
			if ((xhr.readyState == 4) && (xhr.status == 200)) {
				this.closePopout();
			}
		});

		xhr.open('GET', `do-results-update-answers/${test_id}?user_id=${this.state.user_id}`, true);
		xhr.responseType = 'json';
		//
		xhr.setRequestHeader('Autorization', window.location.search);
		//
		xhr.send();
		xhr.onload = () => {
			if (xhr.status != 200) { // анализируем HTTP-статус ответа, если статус не 200, то произошла ошибка
				console.log(`Ошибка ${xhr.status}: ${xhr.statusText}`); // Например, 404: Not Found
			} 
			else { // если всё прошло гладко, выводим результат
				//console.log(xhr.response.state); // response -- это ответ сервера
				this.getTestResult(test_id);
			}
		};

	}

	convertTestInstruction (test_id) {
		this.setState({ testInstruction: '' });

		const showdown = require('showdown');
    	const converter = new showdown.Converter();
			
		const current_instruction = this.state.testList[(test_id - 1)/10].Instruction;

		if (current_instruction != null) {
			this.setState({ testInstruction: converter.makeHtml(current_instruction) });
		}
	}


	// Функции клиента (логика теста)

	nextQuestion (index) {
		// Отправка на сервер ответа пользователя на вопрос
		this.postPersonAnswer(index, this.state.countquest);
		
		// Обновление количества отвеченных вопросов в текущем тесте
		if (this.state.testInformation[this.state.countquest].isDone == 0) {
			const abbr = this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10];
			if (abbr.Question_Done_Count == abbr.Question_Count) {
				this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10].Question_Done_Count = 0;
			}
			else {
				this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10].Question_Done_Count++;
			}

			// Записываем в testInformation, что данный вопрос был отвечен
			this.state.testInformation[this.state.countquest].isDone = 1;
			this.state.testInformation[this.state.countquest].Prev_Answers.push(this.state.testInformation[this.state.countquest].Answers[index].Description);
			this.setState({});
		}
		else if (this.state.testInformation[this.state.countquest].isDone == 1) {
			this.state.testInformation[this.state.countquest].Prev_Answers[0] = this.state.testInformation[this.state.countquest].Answers[index].Description;
			this.setState({});
		}

		
		// Переход к следующему вопросу
		this.state.countquest++;
		this.setState({});

		if (this.state.countquest >= this.state.testInformation.length) {
			
			//this.doResultUpdateAnswers(this.state.testInformation[0].Test_ID);

			for (let i = 0; i < this.state.testInformation.length; i++) {
				this.state.testInformation[i].Prev_Answers = [];
				this.state.testInformation[i].isDone = 0;
			}
			
			this.setState({ countquest: 0, lastQuestionIsAnswered: 1, activePanel: 'results' });
		}
	}

	testActive () {
		this.testAccess();
		
		if (this.state.countquest == 0 && this.state.testInstruction != '') {
			this.setActiveModal('modal-instruction');
		}

		// FIXES: Данный блок, вероятно, является излишним
		if (this.state.countquest >= this.state.testInformation.length) {
			this.setState({ countquest: 0, activePanel: 'questions' });
		}
		else {
			this.setState({ activePanel: 'questions' });
		}
	}

	toNecessaryPanel (panel, test_id) {

		// Отображаем название текущего теста
		this.setState({ currentTestLable: this.state.testList[(test_id - 1) / 10].Name, lastQuestionIsAnswered: 0 });

		// Получаем информацию текущего теста
		this.getInformation(test_id);

		// Конвертируем инструкцию
		this.convertTestInstruction(test_id);

		// Получаем предыдущие результаты
		this.getTestResult(test_id);

		// Переходим на требуемую панель
		this.setState({ activePanel: panel });
	}

	testAccess () {
		// Вывод в консоль длины теста
		//console.log(`Длина списка вопросов = ${this.state.testInformation.length}`);
		for (let i = 0; i < this.state.testInformation.length; i++) {
			if (this.state.testInformation[i].isDone == 0) {
				this.state.countquest = i;
				this.setState({});
				return;
			}
		}
	}


	// Функции клиента (доп. элементы)

	testExit () {
		this.setState({ popout:
		  <Alert
			actionsLayout="horizontal"
			actions={[{
			  title: 'Выйти',
			  autoclose: true,
			  mode: 'destructive',
			  action: () => this.setState({ activePanel: 'test-mainpage'}),
			}, {
			  title: 'Остаться',
			  autoclose: true,
			  mode: 'cancel'
			}]}
			onClose={this.closePopout}
		  >
			<h2>Подтвердите действие</h2>
			<p>Вы уверены, что хотите выйти? Ваши ответы могут не сохраниться.</p>
		  </Alert>
		});
	}

	closePopout () {
		this.setState({ popout: null });
	}

	showFactorClarification (clari_text) {
		if (clari_text == '') {
			return;
		}
		else {
			this.setState({ popout:
				<Alert
					actionsLayout="horizontal"
					actions={[{
					title: 'Ок',
					autoclose: true,
					mode: 'cancel'
					}]}
					onClose={this.closePopout}
				>
					<h2>Описание</h2>
					<p>{clari_text}</p>
				</Alert>
			});
		}
	}

	setActiveModal (modal_name) {
		if (this.state.testInstruction != '') {
			this.setState({ activeModal: modal_name });
		}
	}

	testPassingError () {		
		this.setState({ popout:
			<Alert
				actionsLayout="horizontal"
				actions={[{
				title: 'Ок',
				autoclose: true,
				mode: 'cancel'
				}]}
				onClose={this.closePopout}
			>
				<h2>🤔</h2>
				<p>
					Какое-то из условий теста не было выполнено. Внимательно прочтите инструкцию, прежде чем двигаться дальше. 
					Сделать это можно, нажав на надпись <b>Вопрос №...</b> наверху.
				</p>
			</Alert>
		});
	}


	// Функции клиента (кнопки вперёд-назад)

	goForward () {
		// Если режим текущего вопроса - single
		if (this.state.testInformation[this.state.countquest].Mode === 'single') {

			// Пользователь отвечал ранее на текущий вопрос, но сейчас пропускает его
			if (this.state.testInformation[this.state.countquest].isDone === 1) {
				this.state.countquest++;
				this.setState({});	
			}
			
		}
		// Если режим текущего вопроса - multiple
		else if (this.state.testInformation[this.state.countquest].Mode === 'multiple') {

			// Если тип ответов был checkbox-input или input
			if ((this.state.testInformation[this.state.countquest].Type === 'checkbox-input' || 
				this.state.testInformation[this.state.countquest].Type === 'input') && 
				this.state.inputLabels.length !== 0) {
				for (let i = 0; i < this.state.inputLabels.length; i++) {
					if (this.state.inputLabels[i]) {
						this.state.selectedAnswers.push(this.state.inputLabels[i]);
					}
				}
				this.setState({});
			}

			// Если тип ответов был priority-friends
			if (this.state.testInformation[this.state.countquest].Type === 'priority-friends') {
				// Ограничения на тест "Опрос-ситуации"
				if (this.state.testInformation[0].Test_ID === 41 && this.state.selectedAnswers[0] !== 'Не общаюсь с коллегами ВКонтакте') {
					if ((this.state.testInformation[this.state.countquest].isDone === 0) || 
						(this.state.testInformation[this.state.countquest].isDone === 1 && this.state.selectedAnswers.length !== 0)) {
						if (this.state.selectedAnswers.length < 3) {
							this.testPassingError();
							return;
						}
					}
				}
			}

			// Пользователь не отвечал ранее на текущий вопрос
			if (this.state.testInformation[this.state.countquest].isDone === 0 && this.state.selectedAnswers.length !== 0) {
				
				// Отправка ответа (первого)
				this.postPersonAnswer(0, this.state.countquest); 
				
				const abbr = this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10];
				if (abbr.Question_Done_Count === abbr.Question_Count) {
					this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10].Question_Done_Count = 0;
				}
				else {
					this.state.testList[(this.state.testInformation[0].Test_ID - 1) / 10].Question_Done_Count++;
				}

				// Записываем в testInformation, что данный вопрос был отвечен
				this.state.testInformation[this.state.countquest].isDone = 1;

				for (let i = 0; i < this.state.selectedAnswers.length; i++) {
					this.state.testInformation[this.state.countquest].Prev_Answers[i] = this.state.selectedAnswers[i];
				}

				this.state.selectedAnswers = [];
				this.state.inputLabels = [];

				this.state.countquest++;
				this.setState({});
			}
			// Пользователь отвечал ранее на текущий вопрос, но сейчас пропускает его
			else if (this.state.testInformation[this.state.countquest].isDone === 1 && this.state.selectedAnswers.length === 0) {
				
				this.state.countquest++;
				this.setState({});	
			}
			// Пользователь отвечал ранее на текущий вопрос и сейчас отвечает заново
			else if (this.state.testInformation[this.state.countquest].isDone == 1 && this.state.selectedAnswers.length != 0) {
				
				// Отправка нового ответа
				this.postPersonAnswer(0, this.state.countquest);
				
				this.state.testInformation[this.state.countquest].Prev_Answers = [];
				this.setState({});

				for (let i = 0; i < this.state.selectedAnswers.length; i++) {
					this.state.testInformation[this.state.countquest].Prev_Answers[i] = this.state.selectedAnswers[i];
				}

				this.state.selectedAnswers = [];
				this.state.inputLabels = [];
				this.state.countquest++;
				this.setState({});
			}
		}

		// Если тест закончился
		if (this.state.countquest >= this.state.testInformation.length) {
			
			//this.doResultUpdateAnswers(this.state.testInformation[0].Test_ID);

			for (let i = 0; i < this.state.testInformation.length; i++) {
				this.state.testInformation[i].Prev_Answers = [];
				this.state.testInformation[i].isDone = 0;
			}
			
			this.setState({ countquest: 0, lastQuestionIsAnswered: 1, activePanel: 'results', selectedAnswers: [], inputLabels: [] });
		}
	}

	goBack () {
		if (this.state.countquest != 0)
		{
			this.state.selectedAnswers = [];
			this.state.inputLabels = [];
			this.state.countquest--;
			this.setState({});
		}
	}


	// Функционал различных типов ответа на вопрос

	chooseBox (description) {
		let flag = 0;
		for (let i = 0; i < this.state.selectedAnswers.length; i++) {
			if (this.state.selectedAnswers[i] === description) {
				flag = 1;
				this.state.selectedAnswers.splice(i, 1);
				this.setState({});
				break;
			}
		}
		if (flag === 0) {
			this.state.selectedAnswers.push(description);
			this.setState({});
		}

		// Вывод в консоль списка выбранных ответов
		//console.log(this.state.selectedAnswers);
	}

	inputHandleChange (e) {
		const { name, value } = e.currentTarget;
		
		this.state.inputLabels[Number([name])] = value;
		this.setState({});
	}

	inputHandleSubmit (e) {
		const { name, value } = e.currentTarget;

		const index = Number([name]);
		this.setState({ inputLabels: 
			[
				...this.state.inputLabels.slice(0, index),
				value,
				...this.state.inputLabels.slice(index + 1)
			]
		});

		e.preventDefault();
	}

	chooseFriends (index) {

		// Ограничения на выбор друзей с приоритетом
		if (this.state.testInformation[this.state.countquest].Type === 'priority-friends') {
			for (let i = 0; i < index; i++) {
				if (this.state.selectedAnswers[i] == undefined) {
					this.testPassingError();
					return;
				}
			}
		}

		bridge
			.send("VKWebAppGetFriends", { multi: false })
			.then(data => {
				const current_friend = `${data.users[0].first_name} ${data.users[0].last_name} (${data.users[0].id})`;
				
				if (!this.state.selectedAnswers.includes(current_friend)) {
					this.state.selectedAnswers[index] = current_friend;
					this.setState({});
				}
				else {
					this.testPassingError();
				}
			})
			.catch(error => {
				// Обработка ошибки вызова или отказа от добавления друзей
			})
	}

	buttonForMulti (message) {
		this.state.selectedAnswers = [];
		this.state.selectedAnswers[0] = message;
		this.setState({});
		
		// Обработка ответа
		this.goForward();
	}

  
	render() {
	
	const modal = (
		
		<ModalRoot activeModal={this.state.activeModal} onClose={() => this.setActiveModal(null)}>
			<ModalPage id='modal-instruction'
				onClose={() => this.setActiveModal(null)}
				settlingHeight={100}
				header={
				<ModalPageHeader
					right={<PanelHeaderSubmit onClick={() => this.setActiveModal(null)}/>}
				>
					Инструкция
				</ModalPageHeader>
			}
			>
				<Div>
					<Instruction text={this.state.testInstruction}/>
				</Div>
			</ModalPage>
		</ModalRoot>
	);

	  return (
		<View activePanel={this.state.activePanel} popout={this.state.popout} modal={modal}>
		  <Panel id="panel0">
			<PanelHeader>Тесты</PanelHeader>
			<Div>
				{
					this.state.testList.map((ex, index) => (
						<>
						{ex.Test_ID === 41 &&
						<Banner
							key={ex.Test_ID}
							mode='image'
							header={`😎👉${ex.Name}🥴`}
							subheader={`Вы прошли этот тест на ${isNaN((ex.Question_Done_Count * 100) / ex.Question_Count) ? '...' : ((ex.Question_Done_Count * 100) / ex.Question_Count).toFixed(2)}%.`}
							imageTheme
							background={
							<div
								style={{
								backgroundImage: 'url(https://color-hex.org/colors/ffff99.png)',
								backgroundSize: 2080,
								}}
							/>
							}
							asideMode="expand"
							onClick={() => this.toNecessaryPanel('test-mainpage', ex.Test_ID)}
					  	/>
						}
						{ex.Test_ID !== 41 &&
						<Banner
							key={ex.Test_ID}
							header={ex.Name}
							subheader={`Вы прошли этот тест на ${isNaN((ex.Question_Done_Count * 100) / ex.Question_Count) ? '...' : ((ex.Question_Done_Count * 100) / ex.Question_Count).toFixed(2)}%.`}
							asideMode="expand"
							onClick={() => this.toNecessaryPanel('test-mainpage', ex.Test_ID)}
					  	/>
						}
						</>
					))
				}
			</Div>
		  </Panel>

		  <Panel id="test-mainpage">
		  	<PanelHeader left={<PanelHeaderBack onClick={() => this.setState({ activePanel: 'panel0' })}/>}>
				{this.state.currentTestLable}
			</PanelHeader>
				<Div>
					<Banner
						header='Пройти тест'
						asideMode="expand"
						onClick={() => this.testActive()}
					/>
					<Banner
						header='Результаты'
						asideMode="expand"
						onClick={() => this.setState({ activePanel: 'results' })}
					/>
				</Div>
		  </Panel>
		  
		  <Panel id="questions">
		  	<PanelHeader left={<PanelHeaderBack onClick={this.testExit}/>}>
				<PanelHeaderContent onClick={() => this.setActiveModal('modal-instruction')}>
					Вопрос {this.state.countquest + 1}
					&nbsp;<img 
								src={one_tap}
								style={{ 'height': '13%', 'width': '13%' }}
								alt='instruction tap'
							/>
				</PanelHeaderContent>
			</PanelHeader>
			<Group>
				{(this.state.testInformation.length > 0) && 
				 (this.state.countquest < this.state.testInformation.length) &&
				 (this.state.testInformation[this.state.countquest].Photo !== '') &&
					<Div>
						<img 
							src={this.state.testInformation[this.state.countquest].Photo} 
							style={{ 'max-height': '720', 'max-width': '1080px', 
									 'height': '100%', 'width': '100%', 
									 'object-fit': 'contain'}}
							alt='question pic'
						/>
					</Div>
				}
	  			{this.state.testInformation.length > 0 && this.state.countquest < this.state.testInformation.length &&
					<Div>{this.state.testInformation[this.state.countquest].Question_Description}</Div>
				}
				<Separator/>
				<Div>
					<Group>
            			<Progress value={this.state.countquest * (100/this.state.testInformation.length)}/>
      				</Group>
				</Div>
				{this.state.testInformation.length > 0 && this.state.countquest < this.state.testInformation.length &&
					<Div>
						{ /* Ответы для вопросов с типом button (кнопки) */ }
						{this.state.testInformation[this.state.countquest].Type == 'button' &&
						<>
						{
							this.state.testInformation[this.state.countquest].Answers.map((ex, index) => (
								<Group key={index}>
									<Button size="xl" stretched mode="secondary" onClick={() => this.nextQuestion(index)}>{ex.Description}</Button>
								</Group>
							))
						}
						</>
						}
						{ /* Ответы для вопросов с типом checkbox (чекбоксы) */ }
						{this.state.testInformation[this.state.countquest].Type == 'checkbox' &&
						<>
						{
							this.state.testInformation[this.state.countquest].Answers.map((ex, index) => (
								<Group key={index}>
									<Checkbox onClick={() => this.chooseBox(ex.Description)} 
											  checked={this.state.selectedAnswers.includes(ex.Description)}>
										{ex.Description}
									</Checkbox>
								</Group>
							))
						}
						</>
						}
						{ /* Ответы для вопросов с типом checkbox-input (чекбоксы и форма для ввода снизу) */ }
						{this.state.testInformation[this.state.countquest].Type == 'checkbox-input' &&
						<>
						{
							this.state.testInformation[this.state.countquest].Answers.map((ex, index) => (
								<Group key={index}>
									{index !== (this.state.testInformation[this.state.countquest].Answers.length - 1) &&
									<Checkbox onClick={() => this.chooseBox(ex.Description)} 
											  checked={this.state.selectedAnswers.includes(ex.Description)}>
										{ex.Description}
									</Checkbox>
									}
									{index === (this.state.testInformation[this.state.countquest].Answers.length - 1) &&
									<>
									<Div>{ex.Description}</Div>
									<FormLayout onSubmit={this.inputHandleSubmit}>
										<Input
											type="text"
											name="1"
											value={this.state.inputLabels[1]}
											onChange={this.inputHandleChange}
										/>
									</FormLayout>
									</>
									}
								</Group>
							))
						}
						</>
						}
						{ /* Ответы для вопросов с типом input (форма ввода) */ }
						{this.state.testInformation[this.state.countquest].Type == 'input' &&
						<>
						{
							this.state.testInformation[this.state.countquest].Answers.map((ex, index) => (
								<Group key={index}>
									<Div>{ex.Description}</Div>
									<FormLayout onSubmit={this.inputHandleSubmit}>
										<Input
											type="text"
											name={String(index + 1)}
											value={this.state.inputLabels[index + 1]}
											onChange={this.inputHandleChange}
										/>
									</FormLayout>
									<>
									{(index === (this.state.testInformation[this.state.countquest].Answers.length - 1)) && 
										this.state.testInformation[this.state.countquest].Question_ID === 4691  &&
									<Button
										size="xl" 
										stretched mode="secondary" 
										onClick={() => this.buttonForMulti('Не имею аккаунты в данных социальных сетях')}>
										Не имею аккаунты в данных социальных сетях
									</Button>
									}
									</>
								</Group>
							))
						}
						</>
						}
						{ /* Ответы для вопросов с типом priority-friends (друзья с приоритетом) */ }
						{this.state.testInformation[this.state.countquest].Type == 'priority-friends' &&
						<>
						{
							this.state.testInformation[this.state.countquest].Answers.map((ex, index) => (
								<Group key={index}>
									<Button 
										size="xl" 
										stretched mode="secondary" 
										onClick={() => this.chooseFriends(index)}>
											{this.state.selectedAnswers[index] != undefined ? this.state.selectedAnswers[index] : ex.Description}
									</Button>
									{(index === (this.state.testInformation[this.state.countquest].Answers.length - 1)) && 
										(this.state.testInformation[this.state.countquest].Question_ID === 4591  || 
										 this.state.testInformation[this.state.countquest].Question_ID === 4621) &&
									<>
									<Div/>
									<Button
										size="xl" 
										stretched mode="secondary" 
										onClick={() => this.buttonForMulti('Не общаюсь с коллегами ВКонтакте')}>
											Не общаюсь с коллегами ВКонтакте
									</Button>
									</>
									}
								</Group>
							))
						}
						</>
						}
						{
						<>
						{ /* Вывод предыдущих ответов */ }
						{this.state.testInformation[this.state.countquest].Prev_Answers.length !== 0 &&
							<>
								<Div/>
								<Group>
									<Header mode="primary">Ранее выбранные ответы</Header>
									<List>
									{
										this.state.testInformation[this.state.countquest].Prev_Answers.map((ex, index) => (
											<SimpleCell key={index}>
												{ex}
											</SimpleCell>
										))
									}
									</List>
								</Group>
							</>
						}
						</>
						}
						{ /* Кнопки "вперёд-назад" */ }
						{( this.state.testInformation[this.state.countquest].Type != 'button' ||
						   this.state.testList[(this.state.testInformation[0].Test_ID - 1)/10].CanRedo == 1) &&
						<>
							<Div/>
							<Button size="xl" stretched mode="primary" onClick={() => this.goForward()}>Вперёд</Button>
							<p/>
						</>
						}
						{this.state.testList[(this.state.testInformation[0].Test_ID - 1)/10].CanRedo == 1 &&
						<>
							<Button size="xl" stretched mode="primary" onClick={() => this.goBack()}>Назад</Button>
						</>
						}
					</Div>
				}
	  		</Group>
		  </Panel>


		  <Panel id="results">
		  	<PanelHeader left={<PanelHeaderBack onClick={() => this.setState({ activePanel: 'test-mainpage' })}/>}>
				Результаты
			</PanelHeader>
			{this.state.testResult.length != 0 &&
				<>
					<Div>
						{this.state.testResult.map((ex, index) => (
							<Group>
								<Div><b>{ex.section_title}</b></Div>
								<Div>{ex.section_explanation}</Div>
								{ex.factors.length != 0 &&
								<>
								{ex.factors.map((ex_new, index_new) => (
									<SimpleCell onClick={() => this.showFactorClarification(ex_new.clarification)} multiline key={index_new}>
										<InfoRow header={ex_new.name}>
											{ex_new.description}
										</InfoRow>
									</SimpleCell>
								))
								}
								</>
								}
							</Group>
							))
						}
					</Div>
					<Div><Div><b>Дата последнего прохождения:</b> {(this.state.testResult[0].reply_date.substr(8,2) + '.' + this.state.testResult[0].reply_date.substr(5,2) + '.' + this.state.testResult[0].reply_date.substr(0,4) + ' ' + this.state.testResult[0].reply_date.substr(11,5) + ' UTC')}</Div></Div>
				</>
			}
		    {this.state.testResult.length == 0 && this.state.lastQuestionIsAnswered == 0 &&
				<>
					<Div>
						Упс... Кажется, результатов пока нет. Давайте это исправим!😉
					</Div>
					<Div>
						<Button size="xl" align="center" stretched mode="primary" onClick={() => this.testActive()}>Пройти тест</Button>
					</Div>
				</>
			}
		  </Panel>
		</View>
	  )
	}
  }

export default App;
