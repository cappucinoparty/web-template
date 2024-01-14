import React, { useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { ResponsiveImage, Modal } from '../../components';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Make sure this import is placed after the DatePicker import

import ImageCarousel from './ImageCarousel/ImageCarousel';
import ActionBarMaybe from './ActionBarMaybe';

import css from './ListingPage.module.css';

const SectionHero = props => {
  const {
    title,
    listing,
    isOwnListing,
    editParams,
    handleViewPhotosClick,
    imageCarouselOpen,
    onImageCarouselClose,
    onManageDisableScrolling,
  } = props;

  const [startDate, setStartDate] = useState(new Date());
  const hasImages = listing.images && listing.images.length > 0;
  const firstImage = hasImages ? listing.images[0] : null;
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith('scaled'))
    : [];

  // Action bar is wrapped with a div that prevents the click events
  // to the parent that would otherwise open the image carousel
  const actionBar = listing.id ? (
    <div onClick={e => e.stopPropagation()}>
      <ActionBarMaybe
        className={css.actionBarForHeroLayout}
        isOwnListing={isOwnListing}
        listing={listing}
        editParams={editParams}
      />
    </div>
  ) : null;

  const viewPhotosButton = hasImages ? (
    <button className={css.viewPhotos} onClick={handleViewPhotosClick}>
      <FormattedMessage
        id="ListingPage.viewImagesButton"
        values={{ count: listing.images.length }}
      />
    </button>
  ) : null;

  return (
    <div className={css.sectionHero} data-testid="hero">
      <div className={css.imageWrapperForSectionHero} onClick={handleViewPhotosClick}>
        {actionBar}
        <ResponsiveImage
          rootClassName={css.rootForImage}
          alt={title}
          image={firstImage}
          variants={variants}
        />
        {viewPhotosButton}
      </div>
      <Modal
        id="ListingPage.imageCarousel"
        scrollLayerClassName={css.carouselModalScrollLayer}
        containerClassName={css.carouselModalContainer}
        lightCloseButton
        isOpen={imageCarouselOpen}
        onClose={onImageCarouselClose}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
      >
        <ImageCarousel
          images={listing.images}
          imageVariants={['scaled-small', 'scaled-medium', 'scaled-large', 'scaled-xlarge']}
        />
      </Modal>
      <DatePicker selected={startDate} onChange={date => setStartDate(date)} />
    </div>
  );
};

export default SectionHero;
