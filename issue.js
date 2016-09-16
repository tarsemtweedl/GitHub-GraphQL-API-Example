import gql from 'graphql-tag';
import { graphql } from 'react-apollo';
import React from 'react';

import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  ScrollView,
  NavigatorIOS,
  TouchableHighlight,
  WebView,
  ListView,
} from 'react-native';

import _ from 'lodash';

import InfiniteScrollView from 'react-native-infinite-scroll-view';

const IssueCommentsQuery = gql`
  query GetRepositoryIssues($id: ID!, $after: String) {
    node(id: $id) {
      ... on Issue {
        comments(first: 10, after: $after) {
          edges {
            node {
              id
              body
              author {
                id
                login
              }
              reactionGroups {
                id
                viewerHasReacted
                content
                reactions {
                  totalCount
              	}
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    }
  }
`;

const withIssueComments = graphql(IssueCommentsQuery, {
  options: ({ id }) => ({
    variables: {
      id,
      after: null,
    }
  }),
  props: ({ data, ownProps }) => {
    if (data.loading) {
      return { loading: true, fetchNextPage: () => {} };
    }

    if (data.error) {
      console.log(data.error);
    }

    const fetchNextPage = () => {
      return data.fetchMore({
        variables: {
          after: _.last(data.node.comments.edges).cursor,
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
          return {
            node: {
              comments: {
                // Append new comments to the end
                edges: [...previousResult.node.comments.edges, ...fetchMoreResult.data.node.comments.edges],
                pageInfo: fetchMoreResult.data.node.comments.pageInfo,
              }
            }
          }
        }
      })
    }

    return {
      comments: data.node.comments.edges.map(({ node }) => node),
      hasNextPage: data.node.comments.pageInfo.hasNextPage,
      fetchNextPage,
    };
  }
});

const AddReactionMutation = gql`
  mutation AddReaction($clientMutationId: String!, $subjectId: ID!, $content: ReactionContent!) {
    addReaction(input: {
      clientMutationId: $clientMutationId,
      subjectId: $subjectId,
      content: $content
    }) {
      reaction {
        content
      }
    }
  }
`;

const withAddReaction = graphql(AddReactionMutation, {
  props: ({mutate}) => ({
    addReaction: (commentId, reaction) => mutate({
      mutation: AddReactionMutation,
      variables: {
        clientMutationId: new Date().toString(),
        subjectId: commentId,
        content: reaction,
      },
      updateQueries: {
        GetRepositoryIssues: (previousResult, {mutationResult: {data}}) => ({
          ...previousResult,
          ...(data && previousResult.node ? {
            node: {
              ...previousResult.node,
              comments: {
                ...previousResult.node.comments,
                edges: previousResult.node.comments.edges.map(edge => (
                  edge.node.id === commentId ? {
                    ...edge,
                    node: {
                      ...edge.node,
                      reactionGroups: edge.node.reactionGroups.map(reactionGroup => (
                        data.addReaction.reaction.content === reactionGroup.content ? {
                          ...reactionGroup,
                          viewerHasReacted: true,
                          reactions: {
                            ...reactionGroup.reactions,
                            totalCount: reactionGroup.reactions.totalCount + 1,
                          }
                        } : reactionGroup
                      )),
                    },
                  } : edge
                )),
              },
            },
          } : {}),
        }),
      },
      optimisticResponse: {
        addReaction: {
          reaction: {
            content: reaction,
          },
        },
      },
    }),
  }),
});

const RemoveReactionMutation = gql`
  mutation RemoveReaction($clientMutationId: String!, $subjectId: ID!, $content: ReactionContent!) {
    removeReaction(input: {
      clientMutationId: $clientMutationId,
      subjectId: $subjectId,
      content: $content
    }) {
      reaction {
        content
      }
    }
  }
`;

const withRemoveReaction = graphql(RemoveReactionMutation, {
  props: ({mutate}) => ({
    removeReaction: (commentId, reaction) => mutate({
      mutation: RemoveReactionMutation,
      variables: {
        clientMutationId: new Date().toString(),
        subjectId: commentId,
        content: reaction,
      },
      updateQueries: {
        GetRepositoryIssues: (previousResult, {mutationResult: {data}}) => ({
          ...previousResult,
          ...(data && previousResult.node ? {
            node: {
              ...previousResult.node,
              comments: {
                ...previousResult.node.comments,
                edges: previousResult.node.comments.edges.map(edge => (
                  edge.node.id === commentId ? {
                    ...edge,
                    node: {
                      ...edge.node,
                      reactionGroups: edge.node.reactionGroups.map(reactionGroup => (
                        data.removeReaction.reaction.content === reactionGroup.content ? {
                          ...reactionGroup,
                          viewerHasReacted: false,
                          reactions: {
                            ...reactionGroup.reactions,
                            totalCount: Math.max(reactionGroup.reactions.totalCount - 1, 0),
                          }
                        } : reactionGroup
                      )),
                    },
                  } : edge
                )),
              },
            },
          } : {}),
        }),
      },
      optimisticResponse: {
        removeReaction: {
          reaction: {
            content: reaction,
          },
        },
      },
    }),
  }),
});

const REACTION_EMOJI_MAP = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤',
};

class Issue extends React.Component {
  constructor(props) {
    super();

    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

    this.state = {
      dataSource: ds.cloneWithRows(props.comments || []),
    };
  }

  componentWillReceiveProps(newProps) {
    if (newProps.loading) { return; }

    this.setState({
      dataSource: this.state.dataSource.cloneWithRows(newProps.comments)
    })
  }

  render() {
    const {
      id, comments, hasNextPage, loading, fetchNextPage,
      addReaction, removeReaction,
    } = this.props;
    return (
      <View style={{flex: 1}}>
        <ListView
          renderScrollComponent={props => <InfiniteScrollView {...props} />}
          dataSource={this.state.dataSource}
          renderRow={(comment) => {
            return (
              <View key={comment.id}>
                <Text style={styles.commentAuthor}>
                  {comment.author.login}
                </Text>
                <Text style={styles.commentBody}>
                  {comment.body}
                </Text>
                <Text style={styles.reactions}>
                  {comment.reactionGroups.map(reaction => (
                    <Text
                      key={reaction.id}
                      style={[
                        styles.reaction,
                        reaction.viewerHasReacted ? styles.selectedReaction : null,
                        reaction.reactions.totalCount > 0 ? styles.activeReaction : null,
                      ]}
                      onPress={() => reaction.viewerHasReacted ?
                        removeReaction(comment.id, reaction.content) :
                        addReaction(comment.id, reaction.content)}
                    >
                      {REACTION_EMOJI_MAP[reaction.content]}
                      {reaction.reactions.totalCount}
                    </Text>
                  ))}
                </Text>
              </View>
            )
          }}
          onLoadMoreAsync={fetchNextPage}
          canLoadMore={hasNextPage}
          enableEmptySections={true}
        />
      </View>
    );
  }
}

export default withRemoveReaction(withAddReaction(withIssueComments(Issue)));

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 20,
    padding: 10,
  },
  commentBody: {
    fontSize: 18,
    padding: 10,
    paddingBottom: 30,
  },
  reactions: {
    margin: 5,
    flexDirection: 'row',
  },
  reaction: {
    opacity: 0.5,
    fontSize: 20,
  },
  selectedReaction: {
    fontSize: 25,
    fontWeight: 'bold',
  },
  activeReaction: {
    opacity: 1,
  },
});
