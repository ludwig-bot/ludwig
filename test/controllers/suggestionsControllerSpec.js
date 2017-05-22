/*global describe it beforeEach process*/
import {assert} from 'chai';
import _ from 'lodash';
import sinon from 'sinon';
import {SuggestionsController} from '../../controllers/suggestionsController';

describe('suggestionController', () => {
	let suggestionsController;
	beforeEach(() => {
		suggestionsController = new SuggestionsController({github:{accessToken: 'token'}});
	});

	describe('createPullRequest', () => {
		const testData = {
			accessToken: 'accessToken',
			title: 'title',
			description: 'description',
			state: 'state'
		};
		let res = {};
		beforeEach(()=> {
			res = { redirect: sinon.spy(), render: sinon.spy(), req: { session: { passport: { user: {}}}} };
		});

		function successfulRequest(message, validator, redirect) {
			return it(message, (done) => {
				//setup
				const mockedGithubHelper = {
					getHeadReferenceForBranch: sinon.stub().returns(Promise.resolve('branchedReferenceSHA')),
					createReference: sinon.stub().returns(Promise.resolve({})),
					createContent: sinon.stub().returns(Promise.resolve({})),
					createPullRequest: sinon.stub().returns(Promise.resolve({
						body: {
							url: 'API URL for pull request',
							html_url: 'HTML URL for pull request',
							number: 42
						}
					}))
				};

				const state = 'some custom data so that b64 keeps quiet';
				sinon.stub(suggestionsController, 'githubHelper', {
					get: () => {
						return mockedGithubHelper;
					}
				});
				//action
				const createPRPromise = suggestionsController.createPullRequest(_.merge(testData, redirect), res);
				//assert
				createPRPromise.then(() => {
					assert.equal(mockedGithubHelper.createReference.calledOnce, true);
					assert.equal(mockedGithubHelper.createPullRequest.calledOnce, true);
					assert.equal(mockedGithubHelper.createContent.calledOnce, true);
					assert.equal(mockedGithubHelper.getHeadReferenceForBranch.calledOnce, true);
					validator(res);
					
					done();
				});
			});
		}

		successfulRequest('should render the ok page if all remote calls work without errors', (res) => {
			assert.equal(res.render.calledOnce, true);
			assert.deepEqual(res.render.getCall(0).args, [ 'ok', {pullRequestURL: 'HTML URL for pull request'} ]);
		});

		successfulRequest('should redirect if all remote calls work without errors', (res) => {
			assert.equal(res.redirect.calledOnce, true);
			assert.equal(res.redirect.firstCall.args[0], 'redirect_to?contributionId=42&test=1');
		}, { redirect_to: 'redirect_to?contributionId=24&test=1' });

		const paramsCombinationsWithMissingParams = [
			{
				title: 'accessToken is',
				data: {}
			},
			{
				title: 'title is',
				data: {
					accessToken: 'accessToken'
				}
			},
			{
				title: 'description is',
				data: {
					accessToken: 'accessToken',
					title: 'title'
				}
			},
			{
				title: 'state is',
				data: {
					accessToken: 'accessToken',
					title: 'title',
					description: 'description'
				}
			}
		];

		paramsCombinationsWithMissingParams.forEach((testCase) => {
			it(`should return an error if ${testCase.title} missing`, () => {
				//setup
				const testData = testCase.data;
				//action
				suggestionsController.createPullRequest(testData, res);
				//assert
				assert.equal(res.render.calledOnce, true);
				assert.deepEqual(res.render.getCall(0).args, [ 'ko' ]);
			});
		});

		it('should return an error if reference creation call returns an error (and not try to create content)', function (done) {
			//setup
			const createContentSpy = sinon.spy();
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return {
						createReference: sinon.stub().returns(Promise.reject({error: true})),
						createContent: createContentSpy,
						getHeadReferenceForBranch: sinon.stub().returns(Promise.resolve('branchReferenceSHA'))
					};
				}
			});
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, res);
			//assert
			createPRPromise.then(() => {
				assert.equal(res.render.calledOnce, true);
				assert.equal(createContentSpy.called, false);
				assert.deepEqual(res.render.getCall(0).args, [ 'ko' ]);
				done();
			});
		});

		it('should return an error if content creation call returns an error (and not try to create a PR)', function (done) {
			//setup
			const createPullRequestSpy = sinon.spy();
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return {
						createReference: sinon.stub().returns(Promise.resolve({data: true})),
						createContent: sinon.stub().returns(Promise.reject({error: true})),
						createPullRequest: createPullRequestSpy,
						getHeadReferenceForBranch: sinon.stub().returns(Promise.resolve('branchReferenceSHA'))
					};
				}
			});
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, res);
			//assert
			createPRPromise.then(() => {
				assert.equal(res.render.calledOnce, true);
				assert.equal(createPullRequestSpy.called, false);

				assert.deepEqual(res.render.getCall(0).args, [ 'ko' ]);
				done();
			});
		});

		it('should return an error if pull request creation call returns an error', function (done) {
			//setup
			const githubHelperStub = {
				createReference: sinon.stub().returns(Promise.resolve({data: true})),
				createContent: sinon.stub().returns(Promise.resolve({data: true})),
				createPullRequest: sinon.stub().returns(Promise.resolve({error: true})),
				getHeadReferenceForBranch: sinon.stub().returns(Promise.resolve('branchReferenceSHA'))
			};
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return githubHelperStub;
				}
			});
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, res);
			//assert
			createPRPromise.then(() => {
				assert.equal(res.render.calledOnce, true);
				assert.equal(githubHelperStub.createPullRequest.calledOnce, true);

				assert.deepEqual(res.render.getCall(0).args, [ 'ko' ]);
				done();
			});
		});

		it('should create a commit using the logged in user session data (username and email)', (done) => {
			//setup
			const githubHelperStub = {
				createReference: sinon.stub().returns(Promise.resolve({data: true})),
				createContent: sinon.stub().returns(Promise.reject({error: true})),
				createPullRequest: sinon.spy(),
				getHeadReferenceForBranch: sinon.stub().returns(Promise.resolve('branchReferenceSHA'))
			};
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return githubHelperStub;
				}
			});
			const customRes = {render:sinon.spy(),req:{session:{passport:{user:{username:'user name', emails:[ {value:'user@mail'} ]}}}}};
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, customRes);
			//assert
			createPRPromise.then(() => {
				assert.equal(githubHelperStub.createContent.calledOnce, true);
				assert.deepEqual(githubHelperStub.createContent.getCall(0).args[5], {username:'user name', emails:[ {value:'user@mail'} ]});

				done();
			});
		});

		it('should return an error if we cannot get a branch reference for specified branch', (done) => {
			//setup
			const githubHelperStub = {
				createReference: sinon.spy(),
				getHeadReferenceForBranch: sinon.stub().returns(Promise.reject({message: 'error getting references'}))
			};
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return githubHelperStub;
				}
			});
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, res);
			//assert
			createPRPromise.then(() => {
				assert.equal(res.render.calledOnce, true);
				assert.equal(githubHelperStub.createReference.called, false);

				assert.deepEqual(res.render.getCall(0).args, [ 'ko' ]);
				done();
			});
		});

		it('should use the "not_master" branch to create pull requests for if branch "not_master" is specified', (done) => {
			//setup
			const suggestionsController = new SuggestionsController({github:{branch:'not_master',
		accessToken: ' accessToken',
		clientID: 'clientID',
		clientSecret: 'clientSecret'}});
			const githubHelperStub = {
				createReference: sinon.spy(),
				getHeadReferenceForBranch: sinon.stub().returns(Promise.reject({}))
			};
			sinon.stub(suggestionsController, 'githubHelper', {
				get: () => {
					return githubHelperStub;
				}
			});
			//action
			const createPRPromise = suggestionsController.createPullRequest(testData, res);
			//assert
			createPRPromise.then(() => {
				assert.equal(githubHelperStub.getHeadReferenceForBranch.calledOnce, true);
				assert.deepEqual(githubHelperStub.getHeadReferenceForBranch.getCall(0).args, [ 'not_master' ]);

				done();
			});
		});
	});
});
