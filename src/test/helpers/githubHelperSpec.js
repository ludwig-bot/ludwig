/*global describe it beforeEach*/
import {assert} from 'chai';
import sinon from 'sinon';
import {GithubHelper} from '../../helpers/githubHelper';
import request from 'superagent';

describe('Github Helper', () => {
	let githubHelper;

	const basicConfig = {
		acceptedTestsLocation:'testsDir',
		github: {},
		repo: 'user/reponame',
	};

	beforeEach(() => {
		githubHelper = new GithubHelper(basicConfig);
	});

	describe('createPullRequestRequestBody', () => {
		it('should generate a correctly constructed pull request request body using the default branch (master) if none is specified', () => {
			//setup
			const head = 'submitterBranch', title = 'PR title', body = 'PR body';
			//action
			const actual = githubHelper.createPullRequestRequestBody(head, title, body);
			//assert
			assert.equal(actual, '{"head":"refs/heads/submitterBranch","base":"master","title":"PR title","body":"PR body"}');
		});

		it('should generate a correctly constructed pull request request body using a custom branch (foobar)', () => {
			//setup
			const head = 'submitterBranch', title = 'PR title', body = 'PR body';
			//action
			const actual = githubHelper.createPullRequestRequestBody(head, title, body, 'foobar');
			//assert
			assert.equal(actual, '{"head":"refs/heads/submitterBranch","base":"foobar","title":"PR title","body":"PR body"}');
		});
	});

	describe('createContentRequestBody', () => {
		it('should include author information if present, and use the 1st email if more than 1 is available', () => {
			//setup
			const base64FileContents = 'Base64 Contents',
				branchName = 'branch to commit to',
				commitMessage = 'commit message',
				committer = { name: 'committerName', email: 'committerEmail' },
				suggestionFileName = 'path for the suggestion file';
			//action
			const actual = githubHelper.createContentRequestBody(suggestionFileName, branchName, commitMessage, base64FileContents,  committer);

			//assert
			const expected = {
				branch: branchName,
				committer: committer,
				content: base64FileContents,
				message: commitMessage,
				path: suggestionFileName,
			};
			assert.deepEqual(JSON.parse(actual), expected);
		});
	});

	describe('createReferenceRequestBody', () => {
		it('should generate a correctly constructed reference creation request body', () => {
			//setup
			const newBranchName = 'newBranchName', branchToCreatePullRequestsFor = 'commit sha1 reference to branch from';
			//action
			const actual = githubHelper.createReferenceRequestBody(newBranchName, branchToCreatePullRequestsFor);
			//assert
			assert.equal(actual, '{"ref":"refs/heads/newBranchName","sha":"commit sha1 reference to branch from"}');
		});
	});

	describe('createPullrequest', () => {
		it('should return a resolved promise if API call went on with no issues', (done) => {
			//setup
			const superAgentConfig = [ {
				pattern: 'https://api.github.com/(.*)',
				post: () => {
					return {ok: 'some data', statusCode: 201};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, superAgentConfig);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});

			//action
			const createPullRequestPromise = githubHelper.createPullRequest('head', 'title', 'body', 'accessToken');
			//assert
			createPullRequestPromise.then((data) => {
				assert.deepEqual(data, {ok: 'some data', statusCode: 201});
				superagentMock.unset();
				done();
			});
		});

		it('should return a rejected promise if an error was thrown during the API call', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				post: () => {
					throw new Error('some PR error message');
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			//action
			const createPullRequestPromise = githubHelper.createPullRequest('head', 'title', 'body', 'accessToken');
			//assert
			createPullRequestPromise.catch((message) => {
				assert.deepEqual(message.message, 'some PR error message');
				superagentMock.unset();
				done();
			});
		});
	});

	describe('createContent', () => {
		it('should return a resolved promise if API call went on with no issues', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				put: () => {
					return {ok: 'some data'};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'createContentRequestBody').returns(sinon.spy());
			//action
			const createContentPromise = githubHelper.createContent('accessToken', 'testFileName', 'branchName', 'commitMessage', 'b64FC==', 'committer');
			//assert
			createContentPromise.then((data) => {
				assert.deepEqual(data, {ok: 'some data'});
				assert.equal(githubHelper.createContentRequestBody.calledOnce, true);
				assert.deepEqual(githubHelper.createContentRequestBody.getCall(0).args, [ 'testsDir/testFileName', 'branchName', 'commitMessage', 'b64FC==', 'committer' ]);
				superagentMock.unset();
				done();
			}).catch( (err) => {
				done(err);
			});
		});

		it('should return a rejected promise if API call threw an error', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				put: () => {
					throw new Error('some content error message');
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			//action
			const createContentPromise = githubHelper.createContent('accessToken', 'testFileName', 'branchName', 'commitMessage', 'b64FC==');
			//assert
			createContentPromise.catch((message) => {
				assert.deepEqual(message.message, 'some content error message');
				superagentMock.unset();
				done();
			});
		});
	});

	describe('createReferenceForBranch', () => {
		it('should return a resolved promise if there is no error', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				post: () => {
					return {ok:'some data', statusCode:201};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/pulls'};
				}
			});
			//action
			const createReferencePromise = githubHelper.createReference('accessToken', 'newBranchName', 'master');
			//assert
			createReferencePromise.then((data) => {
				assert.deepEqual(data, {ok: 'some data', statusCode: 201});
				superagentMock.unset();
				done();
			});
		});

		it('should return a rejected promise if an error is triggered during the call', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				post: () => {
					throw new Error('some new error');
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/pulls'};
				}
			});
			//action
			const createReferencePromise = githubHelper.createReference('accessToken', 'newBranchName', 'master');
			//assert
			createReferencePromise.catch((message) => {
				assert.deepEqual(message.message, 'some new error');
				superagentMock.unset();
				done();
			});
		});
	});

	describe('getHeadReferenceForBranch', () => {
		it('should return a rejected promise if an error occurred when retrieving ref', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/repos/(.*)/(.*)/git/refs/heads/asdf',
				get: () => {
					throw new Error('Can\'t retrieve references');
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/git/refs'};
				}
			});
			//action
			const getHeadReferencesForBranchPromise = githubHelper.getHeadReferenceForBranch('asdf');
			//assert
			getHeadReferencesForBranchPromise.catch((error) => {
				assert.equal(error.message, 'Not able to retrieve reference "asdf"');
				assert.equal(error.details, 'Can\'t retrieve references');
				superagentMock.unset();
				done();
			});

		});

		it('should return a rejected promise if call succeeded but the returned object in the body does not contain an object property', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/repos/(.*)/(.*)/git/refs/heads/foobar',
				get: () => {
					return {body:{}};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/git/refs'};
				}
			});
			//action
			const getHeadReferencesForBranchPromise = githubHelper.getHeadReferenceForBranch('foobar');
			//assert
			getHeadReferencesForBranchPromise.catch((message) => {
				assert.deepEqual(message, {
					message: 'Not able to retrieve reference',
					details: 'No reference data available'
				});
				superagentMock.unset();
				done();
			});
		});

		it('should return a rejected promise if call succeeded but the returned object in the body does not contain an object.sha property', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/repos/(.*)/(.*)/git/refs/heads/foobar',
				get: () => {
					return {body:{object:{}}};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/git/refs'};
				}
			});
			//action
			const getHeadReferencesForBranchPromise = githubHelper.getHeadReferenceForBranch('foobar');
			//assert
			getHeadReferencesForBranchPromise.catch((message) => {
				assert.deepEqual(message, {
					message: 'Not able to retrieve reference',
					details: 'No reference data available'
				});
				superagentMock.unset();
				done();
			});
		});

		it('should return a resolved promise w/ the sha reference of the branch looked up', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/repos/(.*)/(.*)/git/refs/heads/foobar',
				get: () => {
					return {body: {ref:'refs/heads/foobar', object:{sha:'shacode for foobar'}}};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			sinon.stub(githubHelper, 'config', {
				get: () => {
					return {referencesEndpoint: 'https://api.github.com/repos/user/reponame/git/refs'};
				}
			});
			//action
			const getHeadReferencesForBranchPromise = githubHelper.getHeadReferenceForBranch('foobar');
			//assert
			getHeadReferencesForBranchPromise.then((data) => {
				assert.deepEqual(data, 'shacode for foobar');
				superagentMock.unset();
				done();
			});
		});
	});

	describe('getFirstCommitForFile', () => {
		it('should return a rejected promise if there was an error reaching out to Github', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				get: () => {
					throw new Error('Error when reaching Github');
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			//action
			const getFirstCommitForFilePromise = githubHelper.getFirstCommitForFile('file/path');
			//assert
			getFirstCommitForFilePromise.catch((message) => {
				assert.deepEqual(message, {
					message: 'Not able to retrieve commit',
					details: 'Error when reaching Github'
				});
				superagentMock.unset();
				done();
			});
		});

		it('should return the only commit data if there is only one commit', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				get: () => {
					return {body:[ {sha:1, commit:{author:{date:'2016-03-31T09:29:37Z'}}} ]};
				},
				fixtures: () => {
					return {};
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			//action
			const getFirstCommitForFilePromise = githubHelper.getFirstCommitForFile('file/path');
			//assert
			getFirstCommitForFilePromise.then((data) => {
				assert.deepEqual(data, {sha: 1, commit: {author: {date: '2016-03-31T09:29:37Z'}}});
				superagentMock.unset();
				done();
			});
		});

		it('should return the oldest commit data if there are multiple commits (based on author date)', (done) => {
			//setup
			const config = [ {
				pattern: 'https://api.github.com/(.*)',
				get: () => {
					return {
						body: [ {sha: 1, commit: {author: {date: '2016-03-31T09:29:37Z'}}}, {
							sha: 2,
							commit: {author: {date: '2015-03-31T09:29:37Z'}}
						} ]
					};
				},
				fixtures: (match) => {
					if (match[1].match(/repos\/user\/reponame\/commits\?path=file\/path&client_id=(.*)&client_secret=(.*)/)) {
						return {};
					} else {
						assert.fail('Not an adequate URL');
					}
				}
			} ];

			const superagentMock = require('superagent-mock')(request, config);
			sinon.stub(githubHelper, 'agent', {
				get: () => {
					return request;
				}
			});
			//action
			const getFirstCommitForFilePromise = githubHelper.getFirstCommitForFile('file/path');
			//assert
			getFirstCommitForFilePromise.then((data) => {
				assert.deepEqual(data, {sha: 2, commit: {author: {date: '2015-03-31T09:29:37Z'}}});
				superagentMock.unset();
				done();
			});
		});
	});
});