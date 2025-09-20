const feedButton = document.getElementById('feedButton');
const watermelon = document.querySelector('.watermelon');
const mouth = document.querySelector('.mouth');
const WAIT_BEFORE_RETURN = 1200;

let returnTimeoutId = null;

const updateTarget = () => {
  if (!mouth || !watermelon) return;

  const mouthRect = mouth.getBoundingClientRect();
  const watermelonRect = watermelon.getBoundingClientRect();

  if (!mouthRect.width || !mouthRect.height) {
    return;
  }

  const deltaX =
    mouthRect.left + mouthRect.width / 2 - (watermelonRect.left + watermelonRect.width / 2);
  const deltaY =
    mouthRect.top + mouthRect.height / 2 - (watermelonRect.top + watermelonRect.height / 2);

  watermelon.style.setProperty('--target-x', `${deltaX}px`);
  watermelon.style.setProperty('--target-y', `${deltaY}px`);
};

const triggerReflow = (element) => element.offsetWidth;

const startReturn = () => {
  if (watermelon.classList.contains('returning')) return;

  watermelon.classList.remove('at-mouth');
  triggerReflow(watermelon);
  watermelon.classList.add('returning');
  feedButton.textContent = 'Volviendo...';
  if (returnTimeoutId) {
    clearTimeout(returnTimeoutId);
    returnTimeoutId = null;
  }
};

const startFeeding = () => {
  if (watermelon.classList.contains('moving') || watermelon.classList.contains('returning')) {
    return;
  }

  if (watermelon.classList.contains('at-mouth')) {
    startReturn();
    return;
  }

  updateTarget();

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

    returnTimeoutId = setTimeout(() => {
      if (!watermelon.classList.contains('at-mouth')) return;
      startReturn();
      returnTimeoutId = null;
    }, WAIT_BEFORE_RETURN);
  }

  if (event.animationName === 'return-home') {
    watermelon.classList.remove('returning');
    feedButton.textContent = 'Otra vez';
  }
});

const handleResize = () => {
  if (watermelon.classList.contains('moving') || watermelon.classList.contains('returning')) {
    return;
  }

  updateTarget();
};

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

requestAnimationFrame(updateTarget);
