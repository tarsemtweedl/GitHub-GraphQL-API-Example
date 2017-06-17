import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  NavigatorIOS,
  TouchableHighlight,
} from 'react-native';

import _ from 'lodash';

import { graphql, ApolloProvider } from 'react-apollo';
import {login} from './githubLogin';

import ApolloClient, { createNetworkInterface } from 'apollo-client';
import gql from 'graphql-tag';

import Repository from './repository';
import Issue from './issue';

import { username, password } from './config';

let TOKEN = null;

const networkInterface = createNetworkInterface({uri: 'https://api.github.com/graphql'});

networkInterface.use([{
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the header object if needed.
    }

    // Send the login token in the Authorization header
    req.options.headers.authorization = `Bearer ${TOKEN}`;
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});

class IssueReader extends Component {
  constructor() {
    super();
    this.state = { login: false };
  }
  componentDidMount() {
    if (username === 'xxx') {
      throw new Error('Please create a config.js your username and password.');
    }
    login(username, password).then((token) => {
      TOKEN = token;
      this.setState({ login: true });
    });
  }
  routeForIssue(id, title) {
    return {
      title,
      component: Issue,
      passProps: {
        id,
      },
    };
  }
  routeForRepository(login, name) {
    return {
      title: `${login}/${name}`,
      component: Repository,
      passProps: {
        login,
        name,
        goToIssue: (id, title) => {
          this.refs.nav.push(this.routeForIssue(id, title));
        }
      },
    };
  }
  render() {
    const login = 'apollostack';
    const name = 'apollo-client';
    const header = Platform.OS === 'ios' ?
      <NavigatorIOS
        ref="nav"
        style={styles.container}
        initialRoute={this.routeForRepository(login, name)}
        tintColor="#008888"
      /> :
      <View style={styles.container}>
        <Text>{login}/{name}</Text>
        <Repository login={login} name={name} />
      </View>
    ;

    return this.state.login ? (
      <ApolloProvider client={client}>
        {header}
      </ApolloProvider>
    ) : <Text>Logging in</Text>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

AppRegistry.registerComponent('IssueReader', () => IssueReader);
