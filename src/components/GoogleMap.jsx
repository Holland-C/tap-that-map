import React, { Component, createRef } from "react";
import API_KEY from "../API-KEYS/maps-api.js";
import { Paper } from "@material-ui/core";
import Timer from "./Timer";
import mapStyle from "../Data/mapStyling";
import Question from "./Question";
import Score from "./Score.jsx";
import SubmitButton from "./SubmitButton";
import CancelButton from "./CancelButton";
import { database } from "../firebaseInitialise";
import * as calculate from "../utils/calculateFunctions";
import generateCountryQuestions from "../utils/generateCountryQuestions";
import customMarker from "../resources/customMarker";
import customLine from "../resources/customLine";
import * as borderGeojson from "../resources/hq-borders.json";

class GoogleMap extends Component {
  state = {
    allOverlay: [],
    marker: null,
    // markerAdded: false,
    question: null,
    borderData: null,
    countryArr: null,
    roundScore: 0,
    roundDistance: 0,
    totalScore: 0,
    round: 0,
    gameOver: false,
    scoreSubmitted: false,
  };

  googleMapRef = createRef();

  /******** MAP FUNCTIONS ********/
  createGoogleMap = () => {
    return new window.google.maps.Map(this.googleMapRef.current, {
      zoom: 2,
      center: {
        lat: 0,
        lng: 0,
      },
      disableDefaultUI: true,
      styles: mapStyle,
    });
  };

  placeMarker = (latLng) => {
    let newMarker = new window.google.maps.Marker({
      position: latLng,
      map: this.googleMap,
      draggable: true,
      icon: customMarker,
    });

    this.setState(({ allOverlay }) => {
      return { allOverlay: [newMarker, ...allOverlay] };
    });
    return newMarker;
  };

  setMapOnAll = (map) => {
    const { allOverlay } = this.state;
    allOverlay.forEach((overlay) => {
      overlay.setMap(map);
    });
  };

  removeOverlays = () => {
    this.setMapOnAll(null);
    this.setState({ allOverlay: [] });
  };

  submitMarker = (event) => {
    event.preventDefault();

    this.plotLinkLine();
    this.plotCountryBorder();
    // this.createBounds();

    const { marker, question } = this.state;
    if (marker !== null) {
      const markerPosition = {
        lat: marker.position.lat(),
        lng: marker.position.lng(),
      };
      const score = calculate.score(markerPosition, question.position);
      const distance = Math.round(
        calculate.distance(markerPosition, question.position)
      );

      this.setState((currState) => {
        return {
          totalScore: currState.totalScore + score,
          roundScore: score,
          roundDistance: distance,
          scoreSubmitted: true,
        };
      });
    } else {
      // need to look at adding material UI styling to the alert?
      window.alert("You need to place a marker before submitting!");
    }
  };

  plotLinkLine = () => {
    const { marker, question } = this.state;
    const markerPosition = {
      lat: marker.position.lat(),
      lng: marker.position.lng(),
    };
    const linkPath = [markerPosition, question.position];

    const linkLine = new window.google.maps.Polyline({
      path: linkPath,
      ...customLine,
    });

    linkLine.setMap(this.googleMap);

    this.setState(({ allOverlay }) => {
      return { allOverlay: [linkLine, ...allOverlay] };
    });
  };

  plotCountryBorder = () => {
    const { borderData } = this.state;
    this.googleMap.data.addGeoJson(borderData);
    this.googleMap.data.setStyle({
      fillColor: "white",
      fillOpacity: 0.5,
      strokeColor: "black",
      strokeWeight: 0,
    });
  };

  createBounds = () => {
    const { allOverlay } = this.state;

    let resultBounds = new window.google.maps.LatLngBounds();
    allOverlay.forEach((overlay) => {
      resultBounds.extend(overlay);
    });
  };

  /******** QUESTION FUNCTIONS ********/
  // called in componentDidMount and componentDidUpdate
  getQuestion = () => {
    const { countryArr, round } = this.state;
    const location = countryArr[round];

    var country = database.ref(`countries/${location}`);
    country.on("value", (data) => {
      const countryData = data.val();
      const countryObj = { location: location, position: countryData };
      this.setState({
        question: countryObj,
      });
      this.getQuestionGeojson();
    });
  };

  getQuestionGeojson = () => {
    const {
      question: { location },
    } = this.state;

    const locationGeojson = borderGeojson.features.find(
      (feature) => feature.location === location
    );
    const questionBorderData = {
      type: "FeatureCollection",
      features: [locationGeojson],
    };

    this.setState({ borderData: questionBorderData });
  };

  /********* ROUND FUNCTIONS ********/
  updateRound = () => {
    if (this.state.round < 9) {
      this.setState((currState) => {
        this.removeOverlays();
        return {
          round: currState.round++,
          scoreSubmitted: false,
          marker: null,
        };
      });
    } else this.setState({ gameOver: true });
  };

  setRound = (roundsNum) => {
    this.setState({
      round: roundsNum,
    });
  };

  saveScore = () => {
    const scores = database.ref("scores");
    const data = {
      UID: this.props.currentUserId,
      score: this.state.totalScore,
    };
    scores.push(data);
  };

  /******** REACT LIFE CYCLES ********/
  componentDidUpdate(prevProp, prevState) {
    const countryArrChanges = prevState.countryArr !== this.state.countryArr;
    const roundChanges = prevState.round !== this.state.round;
    const gameEnds = prevState.gameOver !== this.state.gameOver;

    if (countryArrChanges || roundChanges) {
      this.getQuestion();
    }
    if (gameEnds) {
      this.saveScore();
    }
  }

  componentDidMount() {
    const googleMapScript = document.createElement("script");
    googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    window.document.body.appendChild(googleMapScript);

    googleMapScript.addEventListener("load", () => {
      this.googleMap = this.createGoogleMap();
      window.google.maps.event.addListener(this.googleMap, "click", (e) => {
        if (this.state.marker === null)
          this.setState({
            marker: this.placeMarker(e.latLng),
          });
      });
    });

    this.setState({
      countryArr: generateCountryQuestions(10),
    });
  }

  render() {
    const {
      totalScore,
      round,
      question,
      gameOver,
      scoreSubmitted,
      roundScore,
      roundDistance,
    } = this.state;
    if (gameOver) return <h1>END OF GAME/Results... </h1>;
    return (
      <>
        {question !== null ? (
          <Question location={question.location} round={round} />
        ) : null}
        <Score totalScore={totalScore} />

        <Paper
          elevation={3}
          square={true}
          id="google-map"
          ref={this.googleMapRef}
          style={{
            width: 0.95 * window.innerWidth,
            height: 0.95 * window.innerHeight,
          }}
        />
        <SubmitButton
          submitMarker={this.submitMarker}
          scoreSubmitted={scoreSubmitted}
        />
        <CancelButton />
        <Timer
          updateRound={this.updateRound}
          roundScore={roundScore}
          roundDistance={roundDistance}
        />
      </>
    );
  }
}

export default GoogleMap;
