module.exports = (url) => {

    const crypto = require('crypto');
    const clientSecret = process.env.SECRET_KEY; // Защищённый ключ из настроек вашего приложения.

    const data = { vk_user_id: 0 };

    /**
     * Верифицирует параметры запуска.
     * @param searchOrParsedUrlQuery
     * @param {string} secretKey
     * @returns {boolean}
     */
     function verifyLaunchParams(searchOrParsedUrlQuery, secretKey) {
        let sign;
        const queryParams = [];
    
        /**
         * Функция, которая обрабатывает входящий query-параметр. В случае передачи
         * параметра, отвечающего за подпись, подменяет "sign". В случае встречи
         * корректного в контексте подписи параметра добавляет его в массив
         * известных параметров.
         * @param key
         * @param value
         */
        const processQueryParam = (key, value) => {
        if (typeof value === 'string') {
            if (key === 'sign') {
            sign = value;
            } else if (key.startsWith('vk_')) {
            queryParams.push({key, value});
            // Сохраняем идентификатор пользователя.
            if (key === 'vk_user_id') {
                data.vk_user_id = value;   
            }
            }
        }
        };
    
        if (typeof searchOrParsedUrlQuery === 'string') {
        // Если строка начинается с вопроса (когда передан window.location.search),
        // его необходимо удалить.
        const formattedSearch = searchOrParsedUrlQuery.startsWith('?')
            ? searchOrParsedUrlQuery.slice(1)
            : searchOrParsedUrlQuery;
    
        // Пытаемся спарсить строку как query-параметр.
        for (const param of formattedSearch.split('&')) {
            const [key, value] = param.split('=');
            processQueryParam(key, value);
        }
        } else {
        for (const key of Object.keys(searchOrParsedUrlQuery)) {
            const value = searchOrParsedUrlQuery[key];
            processQueryParam(key, value);
        }
        }
        // Обрабатываем исключительный случай, когда не найдена ни подпись в параметрах,
        // ни один параметр, начинающийся с "vk_", дабы избежать
        // излишней нагрузки, образующейся в процессе работы дальнейшего кода.
        if (!sign || queryParams.length === 0) {
        return false;
        }
        // Снова создаём query в виде строки из уже отфильтрованных параметров.
        const queryString = queryParams
        // Сортируем ключи в порядке возрастания.
        .sort((a, b) => a.key.localeCompare(b.key))
        // Воссоздаём новый query в виде строки.
        .reduce((acc, {key, value}, idx) => {
            return acc + (idx === 0 ? '' : '&') + `${key}=${encodeURIComponent(value)}`;
        }, '');
    
        // Создаём хеш получившейся строки на основе секретного ключа.
        const paramsHash = crypto
        .createHmac('sha256', secretKey)
        .update(queryString)
        .digest()
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=$/, '');
    
        return paramsHash === sign;
    }
    
    // Если отсутствует строка с параметрами запуска 
    if (url === undefined) {
        return { status: false }
    }

    // Берём только параметры запуска.
    const launchParams = url.slice(url.indexOf('?') + 1);

    // Проверяем, валидны ли параметры запуска.
    const areLaunchParamsValid = verifyLaunchParams(launchParams, clientSecret);

    // Возвращаем результат проверки.
    if (areLaunchParamsValid) {
        return { status: areLaunchParamsValid, vk_user_id: Number(data.vk_user_id) } 
        
        // Один из способов определения параметра vk_uder_id: 
        // Number((url.match(/vk_user_id=[0-9]*/g))[0].replace('vk_user_id=', ''))
    }
    else {
        return { status: areLaunchParamsValid }
    }
}
