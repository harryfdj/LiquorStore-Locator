import google from 'googlethis';

async function test() {
  const results = await google.image('1800 Ultimate Jalapeno Lime 1.75 Lt bottle', { safe: false });
  console.log(JSON.stringify(results.slice(0, 5), null, 2));
}
test();
