import google from 'googlethis';

async function test() {
  const images = await google.image('Fireball 750mL bottle', { safe: false });
  console.log(images[0]);
}

test();
