import './style.css';
import months from './months';
import getDayName from './days';
import domElements from './domElements';
import { getDMS, temperatureConverter } from './converter';

const mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');

mapboxgl.accessToken = 'pk.eyJ1IjoibWlraXN1bSIsImEiOiJja2FvYmE0cHQwcDN0MnlwZmppNnQ4c21vIn0.hw0Slxj8zfqIGrT6TFkagw';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  zoom: 11,
});
map.addControl(new mapboxgl.NavigationControl());

const languages = {
  EN: 'en.json',
  RU: 'ru.json',
  BE: 'be.json',
};

const timesOfDay = {
  night: 'night',
  day: 'day',
};

const apiKey = {
  image: '2f8ea488a21e4fac07f04c7fffc9898d',
  weather: 'd9cbddc7739840c4bd5122238202605',
  translate: 'trnsl.1.1.20200507T084819Z.f390e50612a690db.7c1617d6408fa233a30cc9ef9d5f1a43827ff027',
};

function getImages(time) {
  const url = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${apiKey.image}&tags=nature,summer,${time},weather&tag_mode=all&extras=url_h&format=json&nojsoncallback=1`;
  console.log(url);
  return fetch(url);
}

let isDay;
function updateBackground() {
  const time = isDay === 1 ? timesOfDay.day : timesOfDay.night;
  getImages(time)
    .then((res) => res.json())
    .then((data) => {
      const backgroudImages = data.photos.photo;
      let random = Math.ceil(Math.random() * backgroudImages.length);
      let imageUrl = backgroudImages[random].url_h;
      while (!imageUrl) {
        random = Math.ceil(Math.random() * backgroudImages.length);
        imageUrl = backgroudImages[random].url_h;
      }
      const image = new Image();
      image.onload = function bak() {
        document.body.style.background = `linear-gradient(rgba(8, 15, 26, 0.59) 0%, rgba(17, 17, 46, 0.46) 100%) center center / cover fixed, url('${this.src}') center center no-repeat fixed`;
        document.body.style.backgroundSize = 'cover';
      };
      image.src = imageUrl;
    })
    .catch((error) => {
      console.log(error.message);
      document.body.style.background = 'linear-gradient(rgba(8, 15, 26, 0.59) 0%, rgba(17, 17, 46, 0.46) 100%) center center / cover fixed, url(\'images/background.jpg\') center center no-repeat fixed';
      document.body.style.backgroundSize = 'cover';
    });
}


let currentLanguage = domElements.changeLanguageButton.textContent;

function getYandexTranslate(inputText, language) {
  const url = `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${apiKey.translate}&text=${inputText}&lang=${language.toLowerCase()}`;
  return fetch(url).then((res) => res.json());
}

function translateLocation(lang) {
  const promises = [];
  domElements.locationElements.forEach((element) => {
    const p = getYandexTranslate(element.getAttribute('data'), lang)
      .then((data) => {
        element.textContent = data.text;
      });
    promises.push(p);
  });
  return Promise.all(promises);
}

function translateI18n(lang) {
  return fetch(`languages/${languages[lang]}`)
    .then((res) => res.json())
    .then((langFile) => {
      domElements.elementToTranslate.forEach((element) => {
        const path = element.dataset.i18n.split('.');
        let result = langFile;
        path.forEach((piece) => {
          if (result) {
            result = result[piece];
          }
        });

        if (result) {
          element.textContent = result;
        } else {
          result = element.dataset.i18n;
          result.split(' ').forEach((piece) => {
            const key = piece.replace(':', '');
            const translation = langFile[key];
            if (translation) {
              result = result.replace(key, translation);
            }
          });
          element.textContent = result;
        }
      });
      domElements.searchInput.setAttribute('placeholder', langFile.search);
      const dayElements = domElements.day.getAttribute('data').split(' ');
      domElements.day.innerText = `${langFile.days[dayElements[0]]} ${dayElements[1]} ${langFile.month[dayElements[2]]}`;
    });
}

function translate(lang) {
  const p1 = translateI18n(lang);
  const p2 = translateLocation(lang);
  Promise.all([p1, p2])
    .then(() => {
      currentLanguage = lang;
      domElements.changeLanguageButton.textContent = lang;
      sessionStorage.setItem('language', currentLanguage);
    });
}

function getPosition(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude } = position.coords;
      const { longitude } = position.coords;
      callback(`${latitude}, ${longitude}`)
        .then(() => {
          updateBackground();
        });
    });
  } else {
    domElements.searchInput.textContent = 'Unable to retrieve your location';
  }
}
let marker;
function updatePosition(latitude, longitude) {
  domElements.latitude.setAttribute('data-i18n', `Latitude: ${getDMS(latitude, 'lat')}`);
  domElements.longitude.setAttribute('data-i18n', `Longitude: ${getDMS(longitude, 'long')}`);
  map.flyTo({ center: [longitude, latitude] });
  if (marker) {
    marker.remove();
  }
  marker = new mapboxgl.Marker().setLngLat([longitude, latitude]);
  marker.addTo(map);
}

let timezone;
function calculateTimezone(localtime) {
  const searchDate = new Date(localtime);
  const localDate = new Date();
  timezone = localDate.getUTCHours() - searchDate.getHours();
}
function convertWind(data) {
  return Math.round((data.current.wind_kph * 1000) / 60 / 60);
}

function setWeatherData(data) {
  domElements.currentTemperature.innerText = `${Math.round(data.current.temp_c)}°`;
  domElements.currentWeatherIcon.src = data.current.condition.icon;
  domElements.weatherText.setAttribute('data-i18n', `weather.${data.current.condition.text}`);
  domElements.feelslike.setAttribute('data-i18n', `Feelslike: ${Math.round(data.current.feelslike_c)}°`);
  domElements.wind.setAttribute('data-i18n', `Wind: ${convertWind(data)} m/s`);
  domElements.humidity.setAttribute('data-i18n', `Humidity: ${data.current.humidity}%`);
  domElements.name.setAttribute('data', data.location.name);
  domElements.region.setAttribute('data', data.location.region);
  domElements.country.setAttribute('data', data.location.country);
  domElements.weatherForDay1.innerText = `${Math.round(data.forecast.forecastday[1].day.avgtemp_c)}°`;
  domElements.weatherForDay2.innerText = `${Math.round(data.forecast.forecastday[2].day.avgtemp_c)}°`;
  domElements.weatherIcon1.src = data.forecast.forecastday[1].day.condition.icon;
  domElements.weatherIcon2.src = data.forecast.forecastday[2].day.condition.icon;
  updatePosition(data.location.lat, data.location.lon);
  calculateTimezone(data.location.localtime);
  isDay = data.current.is_day;
}


function setWeatherForThirdDay(data) {
  domElements.weatherForDay3.innerText = `${Math.round(data.forecast.forecastday[0].day.avgtemp_c)}°`;
  domElements.weatherIcon3.src = data.forecast.forecastday[0].day.condition.icon;
}

function getWeatherData(value) {
  const weatherDaysUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey.weather}&q=${value}&days=3`;
  return fetch(weatherDaysUrl)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        throw data.error;
      }
      setWeatherData(data);
    });
}

function getWeatherForThirdDay(value) {
  const today = new Date();
  const thirdDay = (new Date(today.setDate(today.getDate() + 3))).toISOString().slice(0, 10);
  const weatherTherdDay = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey.weather}&q=${value}&dt=${thirdDay}`;
  return fetch(weatherTherdDay)
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        throw data.error;
      }
      setWeatherForThirdDay(data);
    });
}

function updateWeather(location) {
  const p1 = getWeatherData(location);
  const p2 = getWeatherForThirdDay(location);
  return Promise.all([p1, p2])
    .then(() => translate(currentLanguage))
    .catch((error) => {
      console.log(error.message);
      domElements.searchInput.value = error.message;
    });
}

function updateDate() {
  const today = new Date();
  const currentDate = today.getDate();
  const currentMonth = today.getUTCMonth();
  const currentDay = today.getDay();
  domElements.day.innerText = `${getDayName(currentDay).substring(0, 3)} ${currentDate} ${months[currentMonth]} `;
  domElements.day.setAttribute('data', domElements.day.innerText);
  domElements.day1.innerText = getDayName(currentDay + 1);
  domElements.day2.innerText = getDayName(currentDay + 2);
  domElements.day3.innerText = getDayName(currentDay + 3);
  domElements.day1.setAttribute('data-i18n', `days.${domElements.day1.innerText}`);
  domElements.day2.setAttribute('data-i18n', `days.${domElements.day2.innerText}`);
  domElements.day3.setAttribute('data-i18n', `days.${domElements.day3.innerText}`);
}

function updateTime() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const today = new Date(utc - (3600000 * timezone));
  const hours = today.getHours();
  const minutes = today.getMinutes();
  const seconds = today.getSeconds();
  const currentTime = `${hours}:${minutes}:${seconds}`;
  domElements.time.innerText = currentTime;
}

domElements.searchForm.addEventListener('keypress', (event) => {
  if (event.keyCode === 13) {
    event.preventDefault();
    updateWeather(domElements.searchInput.value)
      .then(() => updateBackground());
  }
});

function indetifyLanguage() {
  const storedLanguage = sessionStorage.getItem('language');
  if (storedLanguage) {
    currentLanguage = storedLanguage;
  } else {
    currentLanguage = navigator.languages[1].toUpperCase();
  }
}
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognizer = new SpeechRecognition();
recognizer.interimResults = true;
let isSpeachStarted = false;
function speachStart() {
  isSpeachStarted = true;
  domElements.microphone.classList.add('microphone-active');
  recognizer.start();
}

function speachStop() {
  isSpeachStarted = false;
  recognizer.stop();
  domElements.microphone.classList.remove('microphone-active');
}
recognizer.onresult = function recognition(event) {
  if (currentLanguage === 'RU') {
    recognizer.lang = 'ru-RU';
  } else {
    recognizer.lang = 'en-US';
  }
  const result = event.results[event.resultIndex];
  if (result.isFinal) {
    speachStop();
    domElements.searchInput.value = result[0].transcript;
    updateWeather(domElements.searchInput.value);
    updateBackground();
  }
};

window.addEventListener('load', () => {
  getPosition(updateWeather);
  indetifyLanguage();
  updateDate();
  setInterval(updateTime, 1000);
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.dropdown-item')) {
    domElements.languageButton.forEach((el) => el.classList.remove('active'));
    event.target.classList.add('active');
    translate(event.target.textContent);
  } else if (event.target.id === 'buttonSearch') {
    event.preventDefault();
    updateWeather(domElements.searchInput.value)
      .then(() => updateBackground());
  } else if (event.target.id === 'syncButton') {
    updateBackground();
  } else if (event.target.id === 'CelToFar') {
    temperatureConverter('F');
  } else if (event.target.id === 'FarToCel') {
    temperatureConverter('C');
  } else if (event.target.closest('.microphone')) {
    event.preventDefault();
    if (!isSpeachStarted) {
      speachStart();
    } else {
      speachStop();
    }
  }
});
