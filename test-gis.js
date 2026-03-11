import gis from 'g-i-s';

gis('1800 Ultimate Jalapeno Lime 1.75 Lt bottle', (error, results) => {
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(results.slice(0, 5), null, 2));
  }
});
