const fs = require('fs');
const files = [
  'src/views/CustomerPWA/CustomerPWA.tsx',
  'src/context/DatabaseContext.tsx',
  'src/views/TabletKiosk/TabletKiosk.tsx',
  'src/views/SuperAdmin/SuperAdmin.tsx',
  'src/views/OwnerDashboard/OwnerDashboard.tsx'
];
files.forEach(f => {
  try {
    const content = fs.readFileSync(f, 'utf8').split('\n');
    content.forEach((line, i) => {
      if (line.includes('\uc190\ub2d8')) {
        console.log(f + ':' + (i + 1) + ': ' + line.trim());
      }
    });
  } catch (e) {}
});
