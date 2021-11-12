import React from 'react';
import { string, arrayOf, bool, func, number } from 'prop-types';
import dropWhile from 'lodash/dropWhile';
import classNames from 'classnames';

import { FormattedMessage, injectIntl, intlShape } from '../../../util/reactIntl';
import { formatDateWithProximity } from '../../../util/dates';
import { ensureTransaction, ensureUser, ensureListing } from '../../../util/data';
import {
  getProcess,
  getUserTxRole,
  TX_TRANSITION_ACTOR_CUSTOMER,
  TX_TRANSITION_ACTOR_PROVIDER,
} from '../../../util/transaction';
import { propTypes } from '../../../util/types';
import * as log from '../../../util/log';

import { Avatar, InlineTextButton, ReviewRating, UserDisplayName } from '../../../components';

import css from './ActivityFeed.module.css';

const Message = props => {
  const { message, intl } = props;
  const todayString = intl.formatMessage({ id: 'ActivityFeed.today' });
  return (
    <div className={css.message}>
      <Avatar className={css.avatar} user={message.sender} />
      <div>
        <p className={css.messageContent}>{message.attributes.content}</p>
        <p className={css.messageDate}>
          {formatDateWithProximity(message.attributes.createdAt, intl, todayString)}
        </p>
      </div>
    </div>
  );
};

Message.propTypes = {
  message: propTypes.message.isRequired,
  intl: intlShape.isRequired,
};

const OwnMessage = props => {
  const { message, intl } = props;
  const todayString = intl.formatMessage({ id: 'ActivityFeed.today' });
  return (
    <div className={css.ownMessage}>
      <div className={css.ownMessageContentWrapper}>
        <p className={css.ownMessageContent}>{message.attributes.content}</p>
      </div>
      <p className={css.ownMessageDate}>
        {formatDateWithProximity(message.attributes.createdAt, intl, todayString)}
      </p>
    </div>
  );
};

OwnMessage.propTypes = {
  message: propTypes.message.isRequired,
  intl: intlShape.isRequired,
};

const Review = props => {
  const { content, rating } = props;
  return (
    <div>
      <p className={css.reviewContent}>{content}</p>
      {rating ? (
        <ReviewRating
          reviewStarClassName={css.reviewStar}
          className={css.reviewStars}
          rating={rating}
        />
      ) : null}
    </div>
  );
};

Review.propTypes = {
  content: string.isRequired,
  rating: number.isRequired,
};

const hasUserLeftAReviewFirst = (userRole, transaction) => {
  const isCustomer = userRole === TX_TRANSITION_ACTOR_CUSTOMER;
  const process = getProcess(transaction.attributes.processName);
  const userReviewState = isCustomer
    ? process.states.REVIEWED_BY_CUSTOMER
    : process.states.REVIEWED_BY_PROVIDER;

  return process
    .getTransitionsToStates([userReviewState])
    .includes(transaction.attributes.lastTransition);
};

const resolveTransitionMessage = (
  transaction,
  transition,
  listingTitle,
  ownRole,
  otherUsersName,
  onOpenReviewModal
) => {
  const isOwnTransition = transition.by === ownRole;
  const currentTransition = transition.transition;
  const displayName = otherUsersName;
  const process = getProcess(transaction.attributes.processName);
  const transitions = process.transitions;
  const state = process.getState(transaction);

  switch (currentTransition) {
    case transitions.CONFIRM_PAYMENT:
      return isOwnTransition ? (
        <FormattedMessage id="ActivityFeed.ownTransitionPurchased" values={{ listingTitle }} />
      ) : (
        <FormattedMessage
          id="ActivityFeed.transitionPurchased"
          values={{ displayName, listingTitle }}
        />
      );
    case transitions.AUTO_CANCEL:
    case transitions.CANCEL:
    case transitions.AUTO_CANCEL_FROM_DISPUTED:
    case transitions.CANCEL_FROM_DISPUTED:
      return <FormattedMessage id="ActivityFeed.transitionCancel" />;
    case transitions.MARK_RECEIVED_FROM_PURCHASED:
    case transitions.MARK_RECEIVED:
    case transitions.AUTO_MARK_RECEIVED:
    case transitions.MARK_RECEIVED_FROM_DISPUTED:
      // Show the leave a review link if the state is completed and
      // if the current user is the first to leave a review
      const reviewPeriodJustStarted = state === process.states.COMPLETED;

      const reviewAsFirstLink = reviewPeriodJustStarted ? (
        <InlineTextButton onClick={onOpenReviewModal}>
          <FormattedMessage id="ActivityFeed.leaveAReview" values={{ displayName }} />
        </InlineTextButton>
      ) : null;

      return reviewAsFirstLink || <FormattedMessage id="ActivityFeed.transitionMarkReceived" />;
    case transitions.MARK_DELIVERED: {
      const isShipped = transaction.attributes?.protectedData?.deliveryMethod === 'shipping';
      return isOwnTransition && isShipped ? (
        <FormattedMessage id="ActivityFeed.ownTransitionShipped" values={{ listingTitle }} />
      ) : isOwnTransition && !isShipped ? (
        <FormattedMessage id="ActivityFeed.ownTransitionDelivered" values={{ listingTitle }} />
      ) : !isOwnTransition && isShipped ? (
        <FormattedMessage
          id="ActivityFeed.transitionShipped"
          values={{ displayName, listingTitle }}
        />
      ) : (
        <FormattedMessage
          id="ActivityFeed.transitionDelivered"
          values={{ displayName, listingTitle }}
        />
      );
    }
    case transitions.DISPUTE:
      return isOwnTransition ? (
        <FormattedMessage id="ActivityFeed.ownTransitionDisputed" values={{ listingTitle }} />
      ) : (
        <FormattedMessage
          id="ActivityFeed.transitionDisputed"
          values={{ displayName, listingTitle }}
        />
      );
    case transitions.REVIEW_1_BY_PROVIDER:
    case transitions.REVIEW_1_BY_CUSTOMER:
      if (isOwnTransition) {
        return <FormattedMessage id="ActivityFeed.ownTransitionReview" values={{ displayName }} />;
      } else {
        // show the leave a review link if current user is not the first
        // one to leave a review
        const reviewPeriodIsOver = state === process.states.REVIEWED;
        const userHasLeftAReview = hasUserLeftAReviewFirst(ownRole, transaction);
        const reviewAsSecondLink = !(reviewPeriodIsOver || userHasLeftAReview) ? (
          <InlineTextButton onClick={onOpenReviewModal}>
            <FormattedMessage id="ActivityFeed.leaveAReviewSecond" values={{ displayName }} />
          </InlineTextButton>
        ) : null;
        return (
          <FormattedMessage
            id="ActivityFeed.transitionReview"
            values={{ displayName, reviewLink: reviewAsSecondLink }}
          />
        );
      }
    case transitions.REVIEW_2_BY_PROVIDER:
    case transitions.REVIEW_2_BY_CUSTOMER:
      if (isOwnTransition) {
        return <FormattedMessage id="ActivityFeed.ownTransitionReview" values={{ displayName }} />;
      } else {
        return (
          <FormattedMessage
            id="ActivityFeed.transitionReview"
            values={{ displayName, reviewLink: null }}
          />
        );
      }

    default:
      log.error(new Error('Unknown transaction transition type'), 'unknown-transition-type', {
        transitionType: currentTransition,
      });
      return '';
  }
};

const reviewByAuthorId = (transaction, userId) => {
  return transaction.reviews.filter(
    r => !r.attributes.deleted && r.author.id.uuid === userId.uuid
  )[0];
};

const Transition = props => {
  const { transition, transaction, currentUser, intl, onOpenReviewModal } = props;

  const currentTransaction = ensureTransaction(transaction);
  const customer = currentTransaction.customer;
  const provider = currentTransaction.provider;

  const deletedListing = intl.formatMessage({
    id: 'ActivityFeed.deletedListing',
  });
  const listingTitle = currentTransaction.listing.attributes.deleted
    ? deletedListing
    : currentTransaction.listing.attributes.title;
  const lastTransition = currentTransaction.attributes.lastTransition;

  const ownRole = getUserTxRole(currentUser.id, currentTransaction);

  const otherUsersName =
    ownRole === TX_TRANSITION_ACTOR_PROVIDER ? (
      <UserDisplayName user={customer} intl={intl} />
    ) : (
      <UserDisplayName user={provider} intl={intl} />
    );

  const transitionMessage = resolveTransitionMessage(
    transaction,
    transition,
    listingTitle,
    ownRole,
    otherUsersName,
    onOpenReviewModal
  );
  const currentTransition = transition.transition;

  const deletedReviewContent = intl.formatMessage({ id: 'ActivityFeed.deletedReviewContent' });
  let reviewComponent = null;

  const process = getProcess(transaction.attributes.processName);
  const transitionIsReviewed = transition =>
    process.getTransitionsToStates([process.states.REVIEWED]).includes(transition);

  if (transitionIsReviewed(lastTransition)) {
    if (process.isCustomerReview(currentTransition)) {
      const review = reviewByAuthorId(currentTransaction, customer.id);
      reviewComponent = review ? (
        <Review content={review.attributes.content} rating={review.attributes.rating} />
      ) : (
        <Review content={deletedReviewContent} />
      );
    } else if (process.isProviderReview(currentTransition)) {
      const review = reviewByAuthorId(currentTransaction, provider.id);
      reviewComponent = review ? (
        <Review content={review.attributes.content} rating={review.attributes.rating} />
      ) : (
        <Review content={deletedReviewContent} />
      );
    }
  }

  const todayString = intl.formatMessage({ id: 'ActivityFeed.today' });

  return (
    <div className={css.transition}>
      <div className={css.bullet}>
        <p className={css.transitionContent}>•</p>
      </div>
      <div>
        <p className={css.transitionContent}>{transitionMessage}</p>
        <p className={css.transitionDate}>
          {formatDateWithProximity(transition.createdAt, intl, todayString)}
        </p>
        {reviewComponent}
      </div>
    </div>
  );
};

Transition.propTypes = {
  transition: propTypes.transition.isRequired,
  transaction: propTypes.transaction.isRequired,
  currentUser: propTypes.currentUser.isRequired,
  intl: intlShape.isRequired,
  onOpenReviewModal: func.isRequired,
};

const EmptyTransition = () => {
  return (
    <div className={css.transition}>
      <div className={css.bullet}>
        <p className={css.transitionContent}>•</p>
      </div>
      <div>
        <p className={css.transitionContent} />
        <p className={css.transitionDate} />
      </div>
    </div>
  );
};

const isMessage = item => item && item.type === 'message';

// Compare function for sorting an array containing messages and transitions
const compareItems = (a, b) => {
  const itemDate = item => (isMessage(item) ? item.attributes.createdAt : item.createdAt);
  return itemDate(a) - itemDate(b);
};

const organizedItems = (messages, transitions, hideOldTransitions) => {
  const items = messages.concat(transitions).sort(compareItems);
  if (hideOldTransitions) {
    // Hide transitions that happened before the oldest message. Since
    // we have older items (messages) that we are not showing, seeing
    // old transitions would be confusing.
    return dropWhile(items, i => !isMessage(i));
  } else {
    return items;
  }
};

export const ActivityFeedComponent = props => {
  const {
    rootClassName,
    className,
    messages,
    transaction,
    currentUser,
    hasOlderMessages,
    onOpenReviewModal,
    onShowOlderMessages,
    fetchMessagesInProgress,
    intl,
  } = props;
  const classes = classNames(rootClassName || css.root, className);

  const currentTransaction = ensureTransaction(transaction);
  const processName = currentTransaction.attributes.processName;

  // If currentTransaction doesn't have processName, full tx data has not been fetched.
  if (!processName) {
    return null;
  }

  const transitions = currentTransaction.attributes.transitions
    ? currentTransaction.attributes.transitions
    : [];
  const currentCustomer = ensureUser(currentTransaction.customer);
  const currentProvider = ensureUser(currentTransaction.provider);
  const currentListing = ensureListing(currentTransaction.listing);

  const transitionsAvailable = !!(
    currentUser &&
    currentUser.id &&
    currentCustomer.id &&
    currentProvider.id &&
    currentListing.id
  );

  // combine messages and transaction transitions
  const items = organizedItems(messages, transitions, hasOlderMessages || fetchMessagesInProgress);

  const transitionComponent = transition => {
    if (transitionsAvailable) {
      return (
        <Transition
          transition={transition}
          transaction={transaction}
          currentUser={currentUser}
          intl={intl}
          onOpenReviewModal={onOpenReviewModal}
        />
      );
    } else {
      return <EmptyTransition />;
    }
  };

  const messageComponent = message => {
    const isOwnMessage =
      message.sender &&
      message.sender.id &&
      currentUser &&
      currentUser.id &&
      message.sender.id.uuid === currentUser.id.uuid;
    if (isOwnMessage) {
      return <OwnMessage message={message} intl={intl} />;
    }
    return <Message message={message} intl={intl} />;
  };

  const messageListItem = message => {
    return (
      <li id={`msg-${message.id.uuid}`} key={message.id.uuid} className={css.messageItem}>
        {messageComponent(message)}
      </li>
    );
  };

  const transitionListItem = transition => {
    if (getProcess(processName).isRelevantPastTransition(transition.transition)) {
      return (
        <li key={transition.transition} className={css.transitionItem}>
          {transitionComponent(transition)}
        </li>
      );
    } else {
      return null;
    }
  };

  return (
    <ul className={classes}>
      {hasOlderMessages ? (
        <li className={css.showOlderWrapper} key="show-older-messages">
          <InlineTextButton className={css.showOlderButton} onClick={onShowOlderMessages}>
            <FormattedMessage id="ActivityFeed.showOlderMessages" />
          </InlineTextButton>
        </li>
      ) : null}
      {items.map(item => {
        if (isMessage(item)) {
          return messageListItem(item);
        } else {
          return transitionListItem(item);
        }
      })}
    </ul>
  );
};

ActivityFeedComponent.defaultProps = {
  rootClassName: null,
  className: null,
};

ActivityFeedComponent.propTypes = {
  rootClassName: string,
  className: string,

  currentUser: propTypes.currentUser,
  transaction: propTypes.transaction,
  messages: arrayOf(propTypes.message),
  hasOlderMessages: bool.isRequired,
  onOpenReviewModal: func.isRequired,
  onShowOlderMessages: func.isRequired,
  fetchMessagesInProgress: bool.isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const ActivityFeed = injectIntl(ActivityFeedComponent);

export default ActivityFeed;
