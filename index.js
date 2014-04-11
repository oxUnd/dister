var commander = require('commander');
var fs = require('fs');
var os = require('os');
var spawn = require('child_process').spawn;

module.exports = function (argv) {

    var pkg_info = read_package_information();

    commander
        .version(pkg_info.version);

    commander
        .command('publish')
        .description('publish package')
        .action(function (options) {
            var cmd = os.platform == 'win32' ? 'npm.cmd' : 'npm';
            var npm = spawn(cmd, ['publish'], { detach: true });

            var output = '';
            npm.stdout.on('data', function (chunk) {
                console.log(chunk.toString());
                output += chunk.toString();
            });

            npm.stdout.on('end', function () {
                var version = output.replace(/^\+\s*/, '');
                get_npm_package_information(version, commit_git);
            });
            npm.stderr.on('data', function (chunk) {
                process.stdout.write(chunk.toString());
            });
        });

    commander.parse(argv);

    if (argv.length <= 2) {
        commander.outputHelp();
    }
};

function get_npm_package_information(version, cb) {

    var cmd = os.platform == 'win32' ? 'npm.cmd' : 'npm';

    var npm_info = spawn(cmd, ['info', version], {detach: true});
    var info = '';

    npm_info.stdout.on('data', function (chunk) {
        info += chunk.toString();
    });

    npm_info.stdout.on('end', function () {
        info = eval("[" + info.replace(/"/g, '\"') + "]")[0]; 
        cb(info);
    });

    npm_info.stderr.on('data', function (chunk) {
        process.stdout.write(chunk.toString());
    });
}

function commit_git(info) {
    var shasum_filepath = process.cwd() + '/shasum.json';
    var shasum_info = {};

    if (fs.existsSync(shasum_filepath)) {
        shasum_info = JSON.parse(fs.readFileSync(shasum_filepath));
    }

    shasum_info[info.name + '@' + info.version] = {
        'shasum': info.dist.shasum
    };

    fs.writeFileSync(shasum_filepath, JSON.stringify(shasum_info));

    var git_add = spawn('git', ['add', './shasum.json'], {detach: true}); 
    git_add.stdout.on('end', function () {
        var git = spawn('git', ['commit', '-m', '"update shasum"', './shasum.json'], {detach: true});

        git.stdout.on('end', function () {
            process.stdout.write('+ publish [' + info.name + '@' + info.version + ' - ' + info.dist.shasum + ']');
        });

        git.stdout.on('data', function (chunk) {
            process.stdout.write(chunk.toString());
        });

        git.stderr.on('data', function (chunk) {
            process.stdout.write(chunk.toString());
        })

    });

    git_add.stdout.on('data', function (chunk) {
        process.stdout.write(chunk.toString());
    });
}

function read_package_information() {
    var pkg_content = fs.readFileSync(__dirname + '/package.json', {encoding: 'utf-8'});
    return JSON.parse(pkg_content);
}
