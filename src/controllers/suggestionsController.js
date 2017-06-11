import {GithubHelper} from '../helpers/githubHelper';
const FILE_NAME_PREFIX = 'suggestion_';
const BRANCH_PREFIX = 'ludwig-';

class SuggestionsController {
	constructor(configuration) {
		this._configuration = configuration;
		this.createPullRequest = this.createPullRequest.bind(this);
	}

	get githubHelper() {
		if (!this._githubHelper) {
			this._githubHelper = new GithubHelper(this._configuration);
		}
		return this._githubHelper;
	}

	/*
	 This function chains github API calls in order to create a pull request
	 @param req: An expressjs Request object with a ludwig.testSuggestion
	 @param res: An expressjs Response object to get back to the user
	 */
	createPullRequest(req, res, next) {
		const accessToken = this._configuration.github.accessToken;
		const now = (new Date()).getTime();
		const newBranchName = BRANCH_PREFIX + now;

		const testSuggestion = req.ludwig.testSuggestion;

		if (necessaryPullRequestDataIsDefinedAndNotEmpty(accessToken, testSuggestion)) {
			const pullRequestFlowPromise = this.githubHelper.getHeadReferenceForBranch(this._configuration.github.branch);

			return pullRequestFlowPromise
				.then(headerReference => this.githubHelper.createReference(accessToken, newBranchName, headerReference))
				.then(() => {
					const testFileName = `${FILE_NAME_PREFIX}${now}.${this._configuration.testFileExtension}`;
					const stateStringBuffer = new Buffer(testSuggestion.state);
					const base64FileContents = stateStringBuffer.toString('base64');
					return this.githubHelper.createContent(accessToken, testFileName, newBranchName, testSuggestion.description, base64FileContents, req.ludwig.committer);
				})
				.then(() => this.githubHelper.createPullRequest(newBranchName, testSuggestion.title, testSuggestion.description, accessToken))
				.then(newPullRequestData => {
					req.ludwig.pullRequest = newPullRequestData.body;
					next();
				})
				.catch(reason => {
					res.status(500).send(reason);
				});
		} else {
			res.status(500).send({ error: 'Missing input' });
		}
	}
}

/*
 * Checks whether the pull request creation call lacks mandatory data or not
 * */
let necessaryPullRequestDataIsDefinedAndNotEmpty = (accessToken, testSuggestion) => {
	return accessToken && testSuggestion.title && testSuggestion.description && testSuggestion.state;
};

export {SuggestionsController};