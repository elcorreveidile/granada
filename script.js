const feedButton = document.getElementById('feedButton');
const watermelon = document.querySelector('.watermelon');
const WAIT_BEFORE_RETURN = 1200;

const triggerReflow = (element) => element.offsetWidth;

const startReturn = () => {
  if (watermelon.classList.contains('returning')) return;

  watermelon.classList.remove('at-mouth');
  triggerReflow(watermelon);
  watermelon.classList.add('returning');
  feedButton.textContent = 'Volviendo...';
};

const startFeeding = () => {
  if (watermelon.classList.contains('moving') || watermelon.classList.contains('returning')) {
    return;
  }

  if (watermelon.classList.contains('at-mouth')) {
    startReturn();
    return;
  }

  feedButton.textContent = '¡Allá va!';
  watermelon.classList.remove('at-mouth');
  triggerReflow(watermelon);
  watermelon.classList.add('moving');
};

feedButton.addEventListener('click', startFeeding);

watermelon.addEventListener('animationend', (event) => {
  if (event.animationName === 'move-to-mouth') {
    watermelon.classList.remove('moving');
    watermelon.classList.add('at-mouth');
    feedButton.textContent = 'Masticando...';

    setTimeout(() => {
      if (!watermelon.classList.contains('at-mouth')) return;
      startReturn();
    }, WAIT_BEFORE_RETURN);
  }

  if (event.animationName === 'return-home') {
    watermelon.classList.remove('returning');
    feedButton.textContent = 'Otra vez';
  }
});
