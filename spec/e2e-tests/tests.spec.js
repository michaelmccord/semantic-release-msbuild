var semanticRelease = require('semantic-release');
var {gitbox, gitUtils, npmregistry, mockServer} = require('semantic-release-test-utils');
var path = require('path');




const owner = 'git';

const semanticReleaseEnv = {
  GH_TOKEN: gitbox.gitCredential,
  GITHUB_URL: mockServer.url,
  CI: true
}

beforeAll(async function() {
  console.info('Starting test servers....');
  await Promise.allSettled(
    [gitbox.start(),
    npmregistry.start(),
    mockServer.start()]
  );
}, 100000);

afterAll(async function(){
  console.info('Stopping test servers....');
  await Promise.allSettled([
    gitbox.stop(),
    npmregistry.stop(),
    mockServer.stop()
  ])
}, 100000);



describe('verifyConditions',function(){



  it('asdf', async function() {

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
    jasmine.default_timeout_interval = 100000;

    const packageName = 'test-package';
    const gitConfig = await gitbox.createRepo(packageName);
    const config = {
      ...gitConfig,
      plugins: [
        [path.resolve(__dirname,'../../'), {
          projects: [
            {path: path.resolve(__dirname, 'TestProject/TestProject/TestProject.csproj')}
          ]
        }]
      ],
      dryRun: false,
      ci: true
    };
    const cwd = config.cwd;


    let verifyMock = await mockServer.mock(
      `/repos/${owner}/${packageName}`,
      {headers: [{name: 'Authorization', values: [`token ${semanticReleaseEnv.GH_TOKEN}`]}]},
      {body: {permissions: {push: true}}, method: 'GET'}
    );


    gitUtils.gitCommits(['feat: force a release'], {cwd});

    var release = await semanticRelease(config, {cwd, env: semanticReleaseEnv});



  }, 100000);

});


