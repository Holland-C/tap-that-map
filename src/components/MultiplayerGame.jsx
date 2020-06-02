import React, { Component } from "react";
import GoogleMap from "./GoogleMap";
import generateCountryQuestions from "../utils/generateCountryQuestions";
import { database, auth } from "../firebaseInitialise";
import Question from "./Question";
import Timer from "./Timer";
import * as calculate from "../utils/calculateFunctions";
import Score from "./Score";
import MultiplayerStartButton from "./MultiplayerStartButton";
import MultiplayerNextButton from "./MultiplayerNextButton";
import Totaliser from "./Totaliser";
import ResultsPage from "./ResultsPage";
import MultiplayerScoresTracker from "./MultiplayerScoresTracker";
import LoadingScreen from "./LoadingScreen";


class MultiplayerGame extends Component {
  state = {
    userIsReady: false,
    participantsAreReady: false,
    gameIsRunning: false,
    roundIsRunning: false,
    gameIsFinished: false,
    questionArr: [],
    playerMarker: null,
    round: 0,
    roundScore: 0,
    roundDistance: 0,
    totalScore: 0,
    scoreArr: [],
    allPlayersMarkers: {},
    allPlayersScores: [],
  };

  toggleGameIsReady = () => {
    this.setState({ gameIsReady: true });
  };

  recordPlayerMarker = (marker) => {
    this.setState({ playerMarker: marker });
  };

  userReady = () => {
    this.setState({ userIsReady: true });
  };

  startGame = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");

    game.child(gameId).child("startRound1").set(true);
    this.setState({ participantsAreReady: false });
  };

  endRound = () => {
    this.calculateScoreAndDistance();
    this.setState((currState) => {
      return {
        totalScore: currState.totalScore + currState.roundScore,
        roundIsRunning: false,
        userIsReady: false,
        participantsAreReady: false,
      };
    });
  };

  updateRound = () => {
    const { gameId, participants } = this.props;
    const { round } = this.state;
    const game = database.ref("multiplayerGame");

    game
      .child(gameId)
      .child("round")
      .set(round + 1);

    Object.keys(participants).forEach((participant) => {
      game
        .child(gameId)
        .child("participants")
        .child(participant)
        .child("userIsReady")
        .set("false");
    });
  };

  calculateScoreAndDistance = () => {
    let score = 0;
    let distance = 0;

    const { playerMarker, questionArr, round } = this.state;

    if (playerMarker !== null) {
      const question = questionArr[round];

      const markerPosition = {
        lat: playerMarker.position.lat(),
        lng: playerMarker.position.lng(),
      };
      distance = Math.round(
        calculate.distance(markerPosition, question.position)
      );
      score = calculate.score(distance);
    }

    this.setState(({ scoreArr, round }) => {
      const updatedScoreArr = [...scoreArr];
      updatedScoreArr[round] = score;
      return {
        roundScore: score,
        roundDistance: distance,
        scoreArr: updatedScoreArr,
      };
    });
  };

  saveScore = () => {
    const scores = database.ref("scores");
    const { totalScore } = this.state;
    const data = {
      UID: auth.currentUser.uid,
      username: auth.currentUser.displayName,
      score: totalScore,
    };
    scores.push(data);
  };

  checkAllPlayersAreReady = () => {
    const { participants } = this.props;
    if (
      Object.values(participants).every(
        ({ userIsReady }) => userIsReady === true
      )
    ) {
      this.setState({ participantsAreReady: true });
    }
  };

  questionArrListenerFunction = (dbQuestionArr) => {
    const newQuestionArr = dbQuestionArr.val();
    this.setState({ questionArr: newQuestionArr });
  };

  addQuestionArrListener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");
    game
      .child(gameId)
      .child("questionArr")
      .on("value", this.questionArrListenerFunction);
  };

  removeQuestionArrListener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");
    game
      .child(gameId)
      .child("questionArr")
      .off("value", this.questionArrListenerFunction);
  };

  startRound1ListenerFunction = (dbStartRound1) => {
    const newStartRound1 = dbStartRound1.val();
    if (newStartRound1 === true) {
      this.setState({
        userIsReady: false,
        gameIsRunning: true,
        roundIsRunning: true,
        participantsAreReady: false,
      });
    }
  };

  addStartRound1Listener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");
    game
      .child(gameId)
      .child("startRound1")
      .on("value", this.startRound1ListenerFunction);
  };

  removeStartRound1Listener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");
    game
      .child(gameId)
      .child("startRound1")
      .off("value", this.startRound1ListenerFunction);
  };

  roundListenerFunction = (dbRound) => {
    const newRound = dbRound.val();
    this.setState(() => {
      if (newRound === 10) {
        return {
          gameIsReady: false,
          gameIsRunning: false,
          gameIsFinished: true,
          roundIsRunning: false,
        };
      } else if (newRound !== 0) {
        return {
          round: newRound,
          roundIsRunning: true,
          playerMarker: null,
          roundDistance: 0,
          roundScore: 0,
        };
      }
    });
  };

  addRoundListener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");

    game.child(gameId).child("round").on("value", this.roundListenerFunction);
  };

  removeRoundListener = () => {
    const { gameId } = this.props;
    const game = database.ref("multiplayerGame");

    game.child(gameId).child("round").off("value", this.roundListenerFunction);
  };
  componentDidMount() {
    const { isHost, gameId } = this.props;
    this.addQuestionArrListener();
    this.addStartRound1Listener();
    this.addRoundListener();

    if (isHost) {
      const countryArr = generateCountryQuestions(10);
      this.setState({ countryArr });

      const questionArrayForDatabase = [];

      countryArr.forEach((country) => {
        const request = database.ref(`countryList/${country}`);
        request.once("value", (response) => {
          const responsePosition = response.val();

          questionArrayForDatabase.push({
            location: country,
            position: responsePosition.centroid,
            borderData: {
              type: "FeatureCollection",
              features: [
                { type: "Feature", geometry: responsePosition.border },
              ],
            },
          });

          if (questionArrayForDatabase.length === 10) {
            const game = database.ref("multiplayerGame");
            game
              .child(gameId)
              .child("questionArr")
              .set(questionArrayForDatabase);
          }
        });
      });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      questionArr,
      gameIsReady,
      gameIsFinished,
      roundIsRunning,
      userIsReady,
      playerMarker,
      roundScore,
      totalScore,
    } = this.state;
    const { gameId, currentUserId, participants } = this.props;

    const questionArrHasLoaded =
      questionArr !== null &&
      questionArr !== prevState.questionArr &&
      questionArr.length === 10;

    const game = database.ref("multiplayerGame");

    Object.entries(participants).forEach(([id, { userIsReady }]) => {
      if (
        Object.keys(prevProps.participants).includes(id) &&
        userIsReady !== prevProps.participants[id].userIsReady
      ) {
        this.checkAllPlayersAreReady();
      }
    });

    if (questionArrHasLoaded && !gameIsReady) {
      this.toggleGameIsReady();
    }
    if (roundIsRunning !== prevState.roundIsRunning) {
      game
        .child(gameId)
        .child("participants")
        .child(currentUserId)
        .child("roundIsRunning")
        .set(roundIsRunning);
    }
    if (userIsReady !== prevState.userIsReady) {
      game
        .child(gameId)
        .child("participants")
        .child(currentUserId)
        .child("userIsReady")
        .set(userIsReady);
    }
    if (playerMarker !== prevState.playerMarker) {
      let markerLatLng = null;
      if (playerMarker !== null) {
        markerLatLng = {
          lat: playerMarker.position.lat(),
          lng: playerMarker.position.lng(),
        };
      }

      game
        .child(gameId)
        .child("participants")
        .child(currentUserId)
        .child("marker")
        .set(markerLatLng);
    }

    if (totalScore !== prevState.totalScore) {
      game
        .child(gameId)
        .child("participants")
        .child(currentUserId)
        .child("totalScore")
        .set(totalScore);
    }

    if (roundScore !== prevState.roundScore) {
      game
        .child(gameId)
        .child("participants")
        .child(currentUserId)
        .child("roundScore")
        .set(roundScore);
    }

    if (gameIsFinished !== prevState.gameIsFinished) {
      this.saveScore();
    }
  }

  componentWillUnmount() {
    this.removeQuestionArrListener();
    this.removeStartRound1Listener();
    this.removeRoundListener();
  }

  render() {
    const { currentUserId, isHost, participants } = this.props;
    const {
      gameIsReady,
      gameIsFinished,
      userIsReady,
      gameIsRunning,
      roundIsRunning,
      questionArr,
      round,
      roundScore,
      roundDistance,
      totalScore,
      scoreArr,
      participantsAreReady,
    } = this.state;
    if (gameIsReady && !gameIsFinished) {
      return (
        <>
          {!gameIsRunning && (
            <MultiplayerStartButton
              startGame={this.startGame}
              userReady={this.userReady}
              isHost={isHost}
              userIsReady={userIsReady}
              participantsAreReady={participantsAreReady}
            />
          )}
          {gameIsRunning && (
            <>
              <Question location={questionArr[round].location} round={round} />
              <Timer
                updateRound={this.updateRound}
                endRound={this.endRound}
                userIsReady={userIsReady}
                roundIsRunning={roundIsRunning}
              />
              <Score totalScore={totalScore} />
            </>
          )}
          <GoogleMap
            currentUserId={currentUserId}
            round={round}
            question={questionArr[round]}
            recordPlayerMarker={this.recordPlayerMarker}
            gameIsRunning={gameIsRunning}
            roundIsRunning={roundIsRunning}
            endRound={this.endRound}
            participants={participants}
          />
          <MultiplayerNextButton
            gameIsRunning={gameIsRunning}
            roundIsRunning={roundIsRunning}
            updateRound={this.updateRound}
            round={round}
            isHost={isHost}
            participantsAreReady={participantsAreReady}
            userReady={this.userReady}
            userIsReady={userIsReady}
          />
          <Totaliser
            gameIsRunning={gameIsRunning}
            roundIsRunning={roundIsRunning}
            roundScore={roundScore}
            roundDistance={roundDistance}
          />
          <MultiplayerScoresTracker
            currentUserId={currentUserId}
            gameIsRunning={gameIsRunning}
            roundIsRunning={roundIsRunning}
            participants={participants}
          />
        </>
      );
    } else if (gameIsFinished) {
      return (
        <ResultsPage
          scoreArr={scoreArr}
          totalScore={totalScore}
          participants={participants}
        />
      );
    } else {
      return <LoadingScreen/>
    }
  }
}

export default MultiplayerGame;
